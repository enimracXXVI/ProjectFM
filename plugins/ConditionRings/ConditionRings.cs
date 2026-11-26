using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.ConditionRings
{
    /// <summary>
    /// Shows condition and match sharpness as coloured rings with FM's own percentage in them,
    /// in place of the level icons in FM27's player tables. Reads only what FM already shows.
    /// </summary>
    [BepInPlugin("projectfm.conditionrings", "ProjectFM Condition Rings", "1.1.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            ClassInjector.RegisterTypeInIl2Cpp<Ringer>();
            AddComponent<Ringer>();
            L.LogInfo("ProjectFM condition rings loaded.");
        }
    }

    /// <summary>
    /// The user's settings, in BepInEx\config\ProjectFM\ConditionRings.cfg. The file is checked
    /// every 2 seconds (only its saved time) and read again when it changes, so edits show in game
    /// without a restart.
    /// </summary>
    internal class Settings
    {
        public bool Condition = true;
        public bool Sharpness = true;
        public bool ShowNumber = true;
        public float Size = 24f;
        public float Border = 2.5f;
        public float FontSize = 9f;
        public float Fill = 0.18f;
        public int GreenFrom = 90;
        public int LimeFrom = 75;
        public int AmberFrom = 60;
        public Color Green = Hex("#33A854");
        public Color Lime = Hex("#8CC24A");
        public Color Amber = Hex("#F5A623");
        public Color Red = Hex("#EB4236");
        public Color Text = Hex("#FFFFFF");

        public static readonly string Path =
            System.IO.Path.Combine(BepInEx.Paths.ConfigPath, "ProjectFM", "ConditionRings.cfg");

        public static Color Hex(string h)
        {
            h = h.Trim().TrimStart('#');
            if (h.Length != 6 || !int.TryParse(h, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var v))
                return Color.magenta;
            return new Color(((v >> 16) & 255) / 255f, ((v >> 8) & 255) / 255f, (v & 255) / 255f);
        }

        private static string ToHex(Color c) =>
            "#" + ((int)Math.Round(c.r * 255)).ToString("X2") + ((int)Math.Round(c.g * 255)).ToString("X2") +
            ((int)Math.Round(c.b * 255)).ToString("X2");

        public Color ColourFor(int pct) =>
            pct >= GreenFrom ? Green : pct >= LimeFrom ? Lime : pct >= AmberFrom ? Amber : Red;

        public static Settings Load(ManualLogSource log)
        {
            var s = new Settings();
            if (!File.Exists(Path))
            {
                Directory.CreateDirectory(System.IO.Path.GetDirectoryName(Path));
                s.Write();
                return s;
            }
            foreach (var raw in File.ReadAllLines(Path))
            {
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("#") || line.StartsWith("[")) continue;
                int eq = line.IndexOf('=');
                if (eq < 0) continue;
                var k = line.Substring(0, eq).Trim().ToLowerInvariant();
                var v = line.Substring(eq + 1).Trim();
                int hash = v.IndexOf(" #", StringComparison.Ordinal);
                if (hash >= 0) v = v.Substring(0, hash).Trim();
                try { s.Set(k, v); }
                catch { log.LogWarning($"rings settings: can't read \"{line}\""); }
            }
            return s;
        }

        private static bool Yes(string v) =>
            v.Equals("true", StringComparison.OrdinalIgnoreCase) || v.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
            v.Equals("on", StringComparison.OrdinalIgnoreCase) || v == "1";

        private static float Num(string v) => float.Parse(v.Replace(',', '.'), CultureInfo.InvariantCulture);

        private void Set(string k, string v)
        {
            switch (k)
            {
                case "condition": Condition = Yes(v); break;
                case "sharpness": Sharpness = Yes(v); break;
                case "shownumber": ShowNumber = Yes(v); break;
                case "size": Size = Math.Clamp(Num(v), 10f, 60f); break;
                case "border": Border = Math.Clamp(Num(v), 0f, 10f); break;
                case "fontsize": FontSize = Math.Clamp(Num(v), 5f, 30f); break;
                case "fill": Fill = Math.Clamp(Num(v), 0f, 1f); break;
                case "greenfrom": GreenFrom = (int)Num(v); break;
                case "limefrom": LimeFrom = (int)Num(v); break;
                case "amberfrom": AmberFrom = (int)Num(v); break;
                case "green": Green = Hex(v); break;
                case "lime": Lime = Hex(v); break;
                case "amber": Amber = Hex(v); break;
                case "red": Red = Hex(v); break;
                case "text": Text = Hex(v); break;
            }
        }

        private void Write()
        {
            string B(bool b) => b ? "true" : "false";
            string F(float f) => f.ToString("0.##", CultureInfo.InvariantCulture);
            File.WriteAllLines(Path, new[]
            {
                "# ProjectFM Condition Rings settings.",
                "# Edit and save while FM is running: the rings change within 2 seconds.",
                "# Delete this file to go back to the defaults.",
                "",
                "# Which rings to show (true / false). false puts FM's own icon back.",
                $"Condition = {B(Condition)}",
                $"Sharpness = {B(Sharpness)}",
                "# Show the percentage inside the ring",
                $"ShowNumber = {B(ShowNumber)}",
                "",
                "# Look (pixels)",
                $"Size = {F(Size)}",
                $"Border = {F(Border)}",
                $"FontSize = {F(FontSize)}",
                "# How strong the colour inside the ring is, 0 (none) to 1 (solid)",
                $"Fill = {F(Fill)}",
                "",
                "# Colour from this percentage up (below AmberFrom is red)",
                $"GreenFrom = {GreenFrom}",
                $"LimeFrom = {LimeFrom}",
                $"AmberFrom = {AmberFrom}",
                "",
                "# Colours (#RRGGBB)",
                $"Green = {ToHex(Green)}",
                $"Lime = {ToHex(Lime)}",
                $"Amber = {ToHex(Amber)}",
                $"Red = {ToHex(Red)}",
                $"Text = {ToHex(Text)}",
            });
        }
    }

    public class Ringer : MonoBehaviour
    {
        public Ringer(IntPtr ptr) : base(ptr) { }

        private const string RingName = "pfm-ring";
        private float next;
        private int errors;
        private bool told;
        private static Settings S = new Settings();
        private DateTime stamp = DateTime.MinValue;
        private float nextCheck;
        private bool restyle;

        private void CheckSettings()
        {
            if (Time.realtimeSinceStartup < nextCheck) return;
            nextCheck = Time.realtimeSinceStartup + 2f;
            try
            {
                var t = File.Exists(Settings.Path) ? File.GetLastWriteTimeUtc(Settings.Path) : DateTime.MinValue;
                if (t == stamp && t != DateTime.MinValue) return;
                S = Settings.Load(Plugin.L);
                stamp = File.Exists(Settings.Path) ? File.GetLastWriteTimeUtc(Settings.Path) : DateTime.MinValue;
                restyle = true;
                Plugin.L.LogInfo("rings: settings read");
            }
            catch (Exception e) { Plugin.L.LogWarning("rings settings: " + e.Message); }
        }


        private void Update()
        {
            CheckSettings();
            if (restyle) next = 0f;
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.4f;
            try
            {
                int done = Pass();
                restyle = false;
                if (done > 0 && !told) { told = true; Plugin.L.LogInfo($"rings: drawing ({done} on screen)"); }
                errors = 0;
            }
            catch (Exception e)
            {
                if (++errors <= 5) Plugin.L.LogWarning("rings: " + e.Message);
                if (errors >= 5) next = Time.realtimeSinceStartup + 10f;
            }
        }

        private static bool HasClassStarting(VisualElement e, string prefix)
        {
            try
            {
                var list = e.GetClasses().TryCast<Il2CppSystem.Collections.Generic.List<string>>();
                if (list == null) return false;
                int n = list.Count;
                for (int i = 0; i < n && i < list.Count; i++)
                {
                    var c = list[i];
                    if (c != null && c.StartsWith(prefix, StringComparison.Ordinal)) return true;
                }
            }
            catch { }
            return false;
        }

        private static string ClassStarting(VisualElement e, string prefix)
        {
            try
            {
                var list = e.GetClasses().TryCast<Il2CppSystem.Collections.Generic.List<string>>();
                if (list == null) return null;
                int n = list.Count;
                for (int i = 0; i < n && i < list.Count; i++)
                {
                    var c = list[i];
                    if (c != null && c.StartsWith(prefix, StringComparison.Ordinal)) return c;
                }
            }
            catch { }
            return null;
        }

        /// <summary>FM's percentage next to an icon (the sibling it keeps it in), or null.</summary>
        private static int? PercentNear(VisualElement icon, string siblingName)
        {
            var parent = icon.parent;
            if (parent == null) return null;
            for (int i = 0; i < parent.childCount; i++)
            {
                var s = parent[i];
                if (s.name != siblingName) continue;
                var t = FirstText(s, 0);
                if (t == null) return null;
                t = t.Trim().TrimEnd('%').Trim();
                if (int.TryParse(t, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v)) return v;
            }
            return null;
        }

        private static string FirstText(VisualElement e, int depth)
        {
            var te = e.TryCast<TextElement>();
            if (te != null && !string.IsNullOrEmpty(te.text) && te.text.Contains("%")) return te.text;
            if (depth > 4) return null;
            for (int i = 0; i < e.childCount; i++)
            {
                var r = FirstText(e[i], depth + 1);
                if (r != null) return r;
            }
            return null;
        }

        /// <summary>A rough percentage from FM's level icon when the number is not there.</summary>
        private static int FromLevel(string cls, bool sharpness)
        {
            // condition: scaling-icons-condition-level-N-... (1..5); sharpness: ...-sharpness-N-... (1..7)
            var parts = cls.Split('-');
            foreach (var p in parts)
                if (int.TryParse(p, out var n) && n > 0 && n < 10)
                    return sharpness ? (int)Math.Round(n / 7.0 * 100) : n * 20;
            return 0;
        }

        private int Pass()
        {
            int count = 0;
            var docs = UnityEngine.Object.FindObjectsOfType<UIDocument>();
            var stack = new Stack<VisualElement>();
            foreach (var doc in docs)
            {
                var root = doc.rootVisualElement;
                if (root == null) continue;
                stack.Clear();
                stack.Push(root);
                while (stack.Count > 0)
                {
                    var e = stack.Pop();
                    VisualElement[] kids;
                    try
                    {
                        int n = e.childCount;
                        kids = new VisualElement[n];
                        for (int i = 0; i < n; i++) kids[i] = e[i];
                    }
                    catch { continue; }
                    foreach (var k in kids)
                    {
                        if (k == null) continue;
                        if (k.name == RingName) continue;
                        try
                        {
                            if (Handle(k)) { count++; continue; }
                        }
                        catch { }
                        stack.Push(k);
                    }
                }
            }
            return count;
        }

        /// <summary>Puts a ring in place of a condition or sharpness icon; true when it did.</summary>
        private bool Handle(VisualElement e)
        {
            string cls;
            bool sharp;
            if (e.name == "ConditionIcon")
            {
                cls = ClassStarting(e, "scaling-icons-condition-level-");
                if (cls == null) return false;
                sharp = false;
            }
            else
            {
                if (e.childCount != 0) return false;
                cls = ClassStarting(e, "scaling-icons-sharpness-");
                if (cls == null || e.parent == null) return false;
                sharp = true;
            }
            var parent = e.parent;
            VisualElement ring = null;
            for (int i = 0; i < parent.childCount; i++)
                if (parent[i].name == RingName) { ring = parent[i]; break; }
            if (!(sharp ? S.Sharpness : S.Condition))
            {
                // Turned off: put FM's own icon and number back
                if (ring != null)
                {
                    ring.RemoveFromHierarchy();
                    e.style.display = DisplayStyle.Flex;
                    for (int i = 0; i < parent.childCount; i++)
                    {
                        var s2 = parent[i];
                        if (s2.name == (sharp ? "KojuroSharp" : "KojuroPct")) s2.style.display = DisplayStyle.Flex;
                    }
                }
                return true;
            }
            if (ring != null && restyle) { ring.RemoveFromHierarchy(); ring = null; }
            bool injured = !sharp && cls.Contains("injured");
            int? pct = PercentNear(e, sharp ? "KojuroSharp" : "KojuroPct");
            int value = pct ?? FromLevel(cls, sharp);

            if (ring == null)
            {
                ring = MakeRing();
                parent.Insert(parent.IndexOf(e) + 1, ring);
            }
            e.style.display = DisplayStyle.None;
            // FM's own percentage text next to the icon: the ring shows it now
            for (int i = 0; i < parent.childCount; i++)
            {
                var s = parent[i];
                if (s.name == (sharp ? "KojuroSharp" : "KojuroPct")) s.style.display = DisplayStyle.None;
            }

            var colour = injured ? S.Red : S.ColourFor(value);
            var text = injured ? "INJ" : (pct.HasValue && S.ShowNumber ? Math.Max(0, value).ToString(CultureInfo.InvariantCulture) : "");
            Paint(ring, colour, text);
            return true;
        }

        private static VisualElement MakeRing()
        {
            float Size = S.Size;
            var ring = new VisualElement { name = RingName };
            var s = ring.style;
            s.width = new StyleLength(Size);
            s.height = new StyleLength(Size);
            s.minWidth = new StyleLength(Size);
            s.flexShrink = new StyleFloat(0f);
            var r = new StyleLength(Size / 2f);
            s.borderTopLeftRadius = r;
            s.borderTopRightRadius = r;
            s.borderBottomLeftRadius = r;
            s.borderBottomRightRadius = r;
            var w = new StyleFloat(S.Border);
            s.borderTopWidth = w;
            s.borderBottomWidth = w;
            s.borderLeftWidth = w;
            s.borderRightWidth = w;
            s.alignItems = new StyleEnum<Align>(Align.Center);
            s.justifyContent = new StyleEnum<Justify>(Justify.Center);
            s.alignSelf = new StyleEnum<Align>(Align.Center);
            var label = new Label { name = "pfm-ring-label" };
            var ls = label.style;
            ls.fontSize = new StyleLength(S.FontSize);
            ls.unityTextAlign = new StyleEnum<TextAnchor>(TextAnchor.MiddleCenter);
            ls.paddingLeft = new StyleLength(0f);
            ls.paddingRight = new StyleLength(0f);
            ls.paddingTop = new StyleLength(0f);
            ls.paddingBottom = new StyleLength(0f);
            ls.marginLeft = new StyleLength(0f);
            ls.marginRight = new StyleLength(0f);
            ls.marginTop = new StyleLength(0f);
            ls.marginBottom = new StyleLength(0f);
            ls.color = new StyleColor(S.Text);
            ring.Add(label);
            return ring;
        }

        private static void Paint(VisualElement ring, Color colour, string text)
        {
            var s = ring.style;
            var c = new StyleColor(colour);
            s.borderTopColor = c;
            s.borderBottomColor = c;
            s.borderLeftColor = c;
            s.borderRightColor = c;
            s.backgroundColor = new StyleColor(new Color(colour.r, colour.g, colour.b, S.Fill));
            if (ring.childCount > 0)
            {
                var label = ring[0].TryCast<Label>();
                if (label != null && label.text != text) label.text = text;
            }
        }
    }
}
