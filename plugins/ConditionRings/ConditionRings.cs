using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using UnityEngine;
using UnityEngine.UIElements;
using SI.Bindable;

namespace ProjectFM.ConditionRings
{
    /// <summary>
    /// Shows condition and match sharpness as coloured rings with FM's own percentage in them,
    /// in place of the level icons in FM27's player tables. Reads only what FM already shows.
    /// </summary>
    [BepInPlugin("projectfm.conditionrings", "ProjectFM Condition Rings", "1.9.0")]
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
    /// The user's settings, in ConditionRings.cfg next to the plugin (BepInEx\plugins\ProjectFM\ConditionRings). The file is checked
    /// every 2 seconds (only its saved time) and read again when it changes, so edits show in game
    /// without a restart.
    /// </summary>
    internal class Settings
    {
        public bool Condition = true;
        public bool Sharpness = true;
        public bool ShowNumber = true;
        public bool Bold = true;
        public bool FatigueNumber = true;
        public bool MoraleText = true;
        public bool FatigueFmColours = true;
        /// <summary>"ring" or "text": condition and sharpness as a coloured ring or as coloured text only.</summary>
        public bool TextOnly;
        /// <summary>Condition and sharpness in FM's own colours (else the percentage bands below).</summary>
        public bool FmColours = true;
        public Color FatigueFresh = Hex("#33A854");
        public Color FatigueLow = Hex("#8CC24A");
        public Color FatigueMedium = Hex("#F5D423");
        public Color FatigueHigh = Hex("#F5A623");
        public Color FatigueVeryHigh = Hex("#EB4236");

        /// <summary>Colour for FM's fatigue level (its icon class), used when FM's own colour is not there.</summary>
        public Color FatigueColour(string cls)
        {
            var c = cls.ToLowerInvariant();
            if (c.Contains("fresh")) return FatigueFresh;
            if (c.Contains("very") || c.Contains("extreme") || c.Contains("exhaust") || c.Contains("severe")) return FatigueVeryHigh;
            if (c.Contains("high")) return FatigueHigh;
            if (c.Contains("medium") || c.Contains("moderate")) return FatigueMedium;
            if (c.Contains("low")) return FatigueLow;
            return Text;
        }
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
            System.IO.Path.Combine(
                System.IO.Path.GetDirectoryName(typeof(Settings).Assembly.Location) ?? BepInEx.Paths.PluginPath,
                "ConditionRings.cfg");

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
            var seen = new HashSet<string>();
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
                seen.Add(k);
                try { s.Set(k, v); }
                catch { log.LogWarning($"rings settings: can't read \"{line}\""); }
            }
            // Settings added in later versions: written into an existing file with their defaults
            var add = new List<string>();
            if (!seen.Contains("bold")) add.AddRange(new[] { "# The number in bold", "Bold = true" });
            if (!seen.Contains("fatiguenumber")) add.AddRange(new[] { "# Fatigue as a number instead of FM's icon", "FatigueNumber = true" });
            if (!seen.Contains("moraletext")) add.AddRange(new[] { "# Morale: FM's word next to its arrow", "MoraleText = true" });
            if (!seen.Contains("fatiguefmcolours")) add.AddRange(FatigueLines(s));
            if (!seen.Contains("style")) add.AddRange(StyleLines(s));
            if (add.Count > 0) try { File.AppendAllLines(Path, add); } catch { }
            return s;
        }

        private static string[] StyleLines(Settings s) => new[]
        {
            "# Condition and sharpness as a coloured ring (ring) or as coloured text only (text)",
            $"Style = {(s.TextOnly ? "text" : "ring")}",
            "# Condition and sharpness in FM's own colours (true), or by the percentages GreenFrom/LimeFrom/AmberFrom (false)",
            $"FmColours = {(s.FmColours ? "true" : "false")}",
        };

        private static string[] FatigueLines(Settings s) => new[]
        {
            "# Fatigue number colours: true uses FM's own colour for each level (as the MrTini23 skin does);",
            "# false, or when FM's colour is not there, uses these colours by FM's fatigue level",
            $"FatigueFmColours = {(s.FatigueFmColours ? "true" : "false")}",
            $"FatigueFresh = {ToHex(s.FatigueFresh)}",
            $"FatigueLow = {ToHex(s.FatigueLow)}",
            $"FatigueMedium = {ToHex(s.FatigueMedium)}",
            $"FatigueHigh = {ToHex(s.FatigueHigh)}",
            $"FatigueVeryHigh = {ToHex(s.FatigueVeryHigh)}",
        };

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
                case "bold": Bold = Yes(v); break;
                case "fatiguenumber": FatigueNumber = Yes(v); break;
                case "moraletext": MoraleText = Yes(v); break;
                case "fatiguefmcolours": FatigueFmColours = Yes(v); break;
                case "style": TextOnly = v.Trim().Equals("text", StringComparison.OrdinalIgnoreCase); break;
                case "fmcolours": FmColours = Yes(v); break;
                case "fatiguefresh": FatigueFresh = Hex(v); break;
                case "fatiguelow": FatigueLow = Hex(v); break;
                case "fatiguemedium": FatigueMedium = Hex(v); break;
                case "fatiguehigh": FatigueHigh = Hex(v); break;
                case "fatigueveryhigh": FatigueVeryHigh = Hex(v); break;
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
                "# The number in bold",
                $"Bold = {B(Bold)}",
                "# Fatigue as a number instead of FM's icon",
                $"FatigueNumber = {B(FatigueNumber)}",
                "# Morale: FM's word next to its arrow",
                $"MoraleText = {B(MoraleText)}",
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
                "",
            }.Concat(StyleLines(this)).Concat(FatigueLines(this)));
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

        private static string TypeName(VisualElement e)
        {
            try { return e.GetIl2CppType().Name; } catch { return ""; }
        }

        private static bool HasClass(VisualElement e, string cls)
        {
            try { return e.ClassListContains(cls); } catch { return false; }
        }

        /// <summary>The first text inside an element (FM's SIText), or null.</summary>
        private static string AnyText(VisualElement e, int depth)
        {
            var te = e.TryCast<TextElement>();
            if (te != null && !string.IsNullOrEmpty(te.text)) return te.text;
            if (depth > 3) return null;
            for (int i = 0; i < e.childCount; i++)
            {
                var r = AnyText(e[i], depth + 1);
                if (r != null) return r;
            }
            return null;
        }

        /// <summary>
        /// Skins that show condition and sharpness as numbers (MrTini23): FM's icon cell then holds
        /// an SIStyleSetter with an SIText. Condition: inside the element named "Content".
        /// Sharpness: inside a centred row that also holds the cell's tooltip (fatigue has none).
        /// </summary>
        private bool HandleSkinned(VisualElement e)
        {
            // Cheap checks first: this runs on every element of the screen
            var parent = e.parent;
            if (parent == null || e.childCount == 0) return false;
            if (parent.name != "Content" && !HasClass(parent, "regular-horizontal-container-center-all"))
                return false;
            if (TypeName(e) != "SIStyleSetter") return false;
            bool sharp;
            if (parent.name == "Content") sharp = false;
            else if (HasClass(parent, "regular-horizontal-container-center-all"))
            {
                bool tooltip = false;
                for (int i = 0; i < parent.childCount; i++)
                    if (HasClass(parent[i], "absolute-position-fill-container")) { tooltip = true; break; }
                if (!tooltip) return false;
                sharp = true;
            }
            else return false;

            var raw = AnyText(e, 0);
            VisualElement ring = null;
            for (int i = 0; i < parent.childCount; i++)
                if (parent[i].name == RingName) { ring = parent[i]; break; }
            var digits = raw == null ? "" : new string(raw.Where(char.IsDigit).ToArray());
            bool on = sharp ? S.Sharpness : S.Condition;
            if (!on || digits.Length == 0 || digits.Length > 3)
            {
                // Turned off, or not a number (injured…): the skin's own text shows
                if (ring != null) ring.RemoveFromHierarchy();
                e.style.display = DisplayStyle.Flex;
                return true;
            }
            if (ring != null && restyle) { ring.RemoveFromHierarchy(); ring = null; }
            if (ring == null)
            {
                ring = MakeRing();
                parent.Insert(parent.IndexOf(e) + 1, ring);
            }
            e.style.display = DisplayStyle.None;
            int value = int.Parse(digits, CultureInfo.InvariantCulture);
            // The skin's text carries FM's colour already
            Color colour = S.ColourFor(value);
            if (S.FmColours)
            {
                var t = FirstTextElement(e, 0);
                if (t != null) colour = t.resolvedStyle.color;
            }
            Paint(ring, colour, S.ShowNumber ? value.ToString(CultureInfo.InvariantCulture) : "");
            return true;
        }

        /// <summary>Puts a ring in place of a condition or sharpness icon; true when it did.</summary>
        private bool Handle(VisualElement e)
        {
            if (HandleSkinned(e)) return true;
            if (HandleFatigue(e)) return true;
            if (HandleMorale(e)) return true;
            string cls;
            bool sharp;
            string path = null;
            if (e.name == "Image" && e.parent != null && e.parent.name == "Fitness")
            {
                // Match screens (team talk): the heart is an image in "Fitness", fed by the match player
                cls = ClassStarting(e, "scaling-icons-condition-level-");
                if (cls == null) return false;
                sharp = false;
                path = "binding.Condition";
            }
            else if (e.name == "ConditionIcon")
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
            // A number from a skin next to the icon, else FM's own value read through a hidden
            // text bound to the same data the MrTini23 skin shows (player.Condition, binding.Sharpness)
            Color? fm = null;
            int? pct = PercentNear(e, sharp ? "KojuroSharp" : "KojuroPct") ?? BoundValue(e, sharp, path, out fm);
            if (!sharp && pct.HasValue) NoteLevel(cls, pct.Value);
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

            var colour = injured ? S.Red : (S.FmColours && fm.HasValue ? fm.Value : S.ColourFor(value));
            var text = injured ? "INJ" : (pct.HasValue && S.ShowNumber ? Math.Max(0, value).ToString(CultureInfo.InvariantCulture) : "");
            Paint(ring, colour, text);
            return true;
        }

        private const string ValueName = "pfm-value";
        private const string FatigueName = "pfm-fatigue";

        /// <summary>
        /// Fatigue as a number: FM's fatigue cell gives its value as "binding" (the MrTini23 skin
        /// shows that as text); a bold text bound to it replaces the icon.
        /// </summary>
        private bool HandleFatigue(VisualElement e)
        {
            if (e.childCount != 0 || e.parent == null) return false;
            var fcls = ClassStarting(e, "game-concepts-fatigue");
            if (fcls == null || HasClass(e, Skip)) return false;
            // Only in table cells: elsewhere (the condition tooltip's Energy part) the same icon
            // is not fed a number, and 1.5 printed "FM.UI.PersonReference" there
            if (!InTableCell(e)) return false;
            var parent = e.parent;
            SIText text = null;
            for (int i = 0; i < parent.childCount; i++)
            {
                if (parent[i].name == FatigueName) { text = parent[i].TryCast<SIText>(); break; }
                if (parent[i].name == FatigueSetterName && parent[i].childCount > 0) { text = parent[i][0].TryCast<SIText>(); break; }
            }
            if (!S.FatigueNumber)
            {
                if (text != null) Outer(text).RemoveFromHierarchy();
                e.style.display = DisplayStyle.Flex;
                return true;
            }
            if (text != null && restyle) { Outer(text).RemoveFromHierarchy(); text = null; }
            if (text == null)
            {
                try
                {
                    text = new SIText { name = FatigueName };
                    var method = new BindingMethod<SIText>();
                    method.m_kind = BindingMethodKind.Direct;
                    var direct = new DirectBinding();
                    direct.Path = new BindingPath("binding");
                    method.m_direct = direct;
                    text.TextBinding = method;
                    var st = text.style;
                    st.fontSize = new StyleLength(S.FontSize + 3f);
                    st.unityFontStyleAndWeight = new StyleEnum<FontStyle>(S.Bold ? FontStyle.Bold : FontStyle.Normal);
                    st.unityTextAlign = new StyleEnum<TextAnchor>(TextAnchor.MiddleCenter);
                    st.alignSelf = new StyleEnum<Align>(Align.Center);
                    text.pickingMode = PickingMode.Ignore;
                    // FM's own colour for the value: a style setter running FM's fatigue style
                    // table on the value, as the MrTini23 skin's fatigue cell does
                    var setter = S.FatigueFmColours ? FatigueColourSetter() : null;
                    if (setter != null)
                    {
                        setter.Add(text);
                        parent.Insert(parent.IndexOf(e) + 1, setter);
                        try { setter.BindToData(); } catch { }
                    }
                    else parent.Insert(parent.IndexOf(e) + 1, text);
                    try { text.BindToData(); } catch { }
                    fatigueSince[text.Pointer] = Time.realtimeSinceStartup;
                }
                catch (Exception ex)
                {
                    if (!fatigueFailed) { fatigueFailed = true; Plugin.L.LogWarning("rings: fatigue number: " + ex.Message); }
                    return false;
                }
            }
            var raw = text.text;
            if (!string.IsNullOrEmpty(raw))
            {
                if (!int.TryParse(raw.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
                {
                    // Not a number here: FM's icon back, and left alone from now on
                    Outer(text).RemoveFromHierarchy();
                    e.style.display = DisplayStyle.Flex;
                    e.AddToClassList(Skip);
                    return true;
                }
                NoteFatigue(fcls, n);
                // FM's colour came through (the setter added a class)? Else the level's colour from the settings
                bool fmColour = false;
                var holder = text.parent;
                if (holder != null && holder.name == FatigueSetterName)
                {
                    var cl = holder.GetClasses().TryCast<Il2CppSystem.Collections.Generic.List<string>>();
                    fmColour = cl != null && cl.Count > baseSetterClasses;
                }
                if (fmColour) text.style.color = new StyleColor(StyleKeyword.Null);
                else if (!fatigueSince.TryGetValue(text.Pointer, out var at) || Time.realtimeSinceStartup - at > 1.5f)
                    text.style.color = new StyleColor(S.FatigueColour(fcls));
            }
            e.style.display = DisplayStyle.None;
            return true;
        }

        private static bool fatigueFailed;
        private const string FatigueSetterName = "pfm-fatigue-colour";
        private const int baseSetterClasses = 0;
        private static readonly Dictionary<IntPtr, float> fatigueSince = new Dictionary<IntPtr, float>();

        private static VisualElement Outer(SIText text) =>
            text.parent != null && text.parent.name == FatigueSetterName ? text.parent : text;

        // FM's style tables (the assets FM picks its icons with), run on a value by FM's style
        // function, as the MrTini23 skin's cells do: fatigue, condition and sharpness
        private const string StyleFunction = "ccad53b4192c2ed41ad18bae0726dbe4";
        private const string FatigueTable = "be147936b1349a34ca6722ef089cc248";
        private const string ConditionTable = "256d604ac1ad51a4eaf752c77ba39ef6";
        private const string SharpnessTable = "70baf4c8a65a164498f94427cab0d21c";

        /// <summary>FM's serialised arguments for its style function: key, table, column, flag, path.</summary>
        private static byte[] StyleArgs(string table, string column, string path)
        {
            var o = new List<byte> { 5 };
            void Arg(string type, byte[] payload)
            {
                var t = System.Text.Encoding.ASCII.GetBytes(type);
                o.AddRange(BitConverter.GetBytes(1 + t.Length + payload.Length));
                o.Add((byte)t.Length);
                o.AddRange(t);
                o.AddRange(payload);
            }
            byte[] Str(string v) { var b = System.Text.Encoding.ASCII.GetBytes(v); var r = new List<byte> { 1, (byte)b.Length }; r.AddRange(b); return r.ToArray(); }
            Arg("SI.Bindable.BindingKeyVisualArg", new byte[] { 0 });
            var g = new List<byte> { (byte)table.Length };
            g.AddRange(System.Text.Encoding.ASCII.GetBytes(table));
            g.AddRange(new byte[] { 1, 0, 1, 0 });
            Arg("SI.VisualScripting.AssetReferenceVisualArg", g.ToArray());
            Arg("SI.VisualScripting.StringVisualArg", Str(column));
            Arg("SI.VisualScripting.BooleanVisualArg", new byte[] { 1 });
            Arg("SI.VisualScripting.GenericVisualArg`1[SI.Bindable.BindingPath]", Str(path));
            return o.ToArray();
        }

        private static bool setterFailed;

        private static SIStyleSetter FatigueColourSetter() => StyleSetter(FatigueSetterName, StyleArgs(FatigueTable, "StyleClass", "binding"));

        private static SIStyleSetter StyleSetter(string name, byte[] args)
        {
            try
            {
                var setter = new SIStyleSetter { name = name };
                setter.pickingMode = PickingMode.Ignore;
                setter.style.alignSelf = new StyleEnum<Align>(Align.Center);
                var cfg = new SI.VisualScripting.DataDrivenVisualRunnerConfig<SI.VisualScripting.VisualArgs<BindingBag, SIStyleSetter>, SI.VisualScripting.VisualArgs>();
                var guid = new SI.Core.AssetGUID(StyleFunction);
                cfg.m_target = guid;
                var vin = new SI.VisualScripting.VariableVisualArgs();
                vin.m_argumentBytes = args;
                vin.OnAfterDeserialize();
                var din = new SI.VisualScripting.DataDrivenVisualArgs<SI.VisualScripting.VisualArgs<BindingBag, SIStyleSetter>>();
                din.m_variable = vin;
                cfg.m_inputs = din;
                var vout = new SI.VisualScripting.VariableVisualArgs();
                vout.m_argumentBytes = new byte[0];
                vout.OnAfterDeserialize();
                var dout = new SI.VisualScripting.DataDrivenVisualArgs<SI.VisualScripting.VisualArgs>();
                dout.m_variable = vout;
                cfg.m_outputs = dout;
                setter.m_bindFunction = cfg;
                return setter;
            }
            catch (Exception ex)
            {
                if (!setterFailed) { setterFailed = true; Plugin.L.LogWarning("rings: FM's colours not available, using the settings' colours: " + ex.Message); }
                return null;
            }
        }
        private const string Skip = "pfm-skip";

        private static bool InTableCell(VisualElement e)
        {
            int d = 0;
            for (var p = e.parent; p != null && d < 12; p = p.parent, d++)
            {
                if (HasClass(p, "sitooltip")) return false;
                if (HasClass(p, "streamed-table__cell")) return true;
            }
            return false;
        }

        // Which fatigue numbers FM draws with which icon, to colour the numbers like FM
        private static readonly SortedDictionary<string, (int min, int max)> fatigueLevels = new SortedDictionary<string, (int, int)>();
        private static float fatigueLogAt;

        private static void NoteFatigue(string cls, int n)
        {
            bool changed = false;
            if (fatigueLevels.TryGetValue(cls, out var r))
            {
                if (n < r.min) { r.min = n; changed = true; }
                if (n > r.max) { r.max = n; changed = true; }
                fatigueLevels[cls] = r;
            }
            else { fatigueLevels[cls] = (n, n); changed = true; }
            if (changed && Time.realtimeSinceStartup > fatigueLogAt)
            {
                fatigueLogAt = Time.realtimeSinceStartup + 5f;
                var parts = new List<string>();
                foreach (var kv in fatigueLevels) parts.Add($"{kv.Key}: {kv.Value.min} to {kv.Value.max}");
                Plugin.L.LogInfo("rings: FM's fatigue icons so far: " + string.Join(", ", parts));
            }
        }

        private const string MoraleName = "pfm-morale";

        /// <summary>
        /// Morale with its word: FM's morale cell without text (the table's) gets the text FM's
        /// own morale cell with text shows, bound to binding.MoraleString, next to the arrow.
        /// </summary>
        private bool HandleMorale(VisualElement e)
        {
            if (e.name != "Morale" || e.parent == null || e.parent.name != "HasPlayer") return false;
            SIText text = null;
            for (int i = 0; i < e.childCount; i++)
                if (e[i].name == MoraleName) { text = e[i].TryCast<SIText>(); break; }
            if (!S.MoraleText) { text?.RemoveFromHierarchy(); return true; }
            if (text != null) return true;
            try
            {
                text = new SIText { name = MoraleName };
                var method = new BindingMethod<SIText>();
                method.m_kind = BindingMethodKind.Direct;
                var direct = new DirectBinding();
                direct.Path = new BindingPath("binding.MoraleString");
                method.m_direct = direct;
                text.TextBinding = method;
                // FM's own morale-with-text cell styles it like this
                foreach (var c in new[] { "text-regular", "white", "padding-left-global-padding-small" }) text.AddToClassList(c);
                text.style.unityTextAlign = new StyleEnum<TextAnchor>(TextAnchor.MiddleLeft);
                text.style.whiteSpace = new StyleEnum<WhiteSpace>(WhiteSpace.NoWrap);
                text.pickingMode = PickingMode.Ignore;
                // The arrow sits in a layer filling the cell: make room beside it
                e.style.flexDirection = new StyleEnum<FlexDirection>(FlexDirection.Row);
                e.style.alignItems = new StyleEnum<Align>(Align.Center);
                e.Add(text);
                try { text.BindToData(); } catch { }
            }
            catch (Exception ex)
            {
                if (!moraleFailed) { moraleFailed = true; Plugin.L.LogWarning("rings: morale text: " + ex.Message); }
            }
            return true;
        }

        private static bool moraleFailed;

        // Which condition percentages FM draws with which heart (its icon level), to match FM
        private static readonly SortedDictionary<string, (int min, int max)> levels = new SortedDictionary<string, (int, int)>();
        private static float levelsLogAt;

        private static void NoteLevel(string cls, int pct)
        {
            var key = cls.Replace("scaling-icons-condition-", "");
            bool changed = false;
            if (levels.TryGetValue(key, out var r))
            {
                if (pct < r.min) { r.min = pct; changed = true; }
                if (pct > r.max) { r.max = pct; changed = true; }
                levels[key] = r;
            }
            else { levels[key] = (pct, pct); changed = true; }
            if (changed && Time.realtimeSinceStartup > levelsLogAt)
            {
                levelsLogAt = Time.realtimeSinceStartup + 5f;
                var parts = new List<string>();
                foreach (var kv in levels) parts.Add($"{kv.Key}: {kv.Value.min}-{kv.Value.max}%");
                Plugin.L.LogInfo("rings: FM's hearts so far: " + string.Join(", ", parts));
            }
        }

        /// <summary>FM's condition or sharpness for the cell, from a hidden bound text.</summary>
        private static int? BoundValue(VisualElement icon, bool sharp, string path = null) => BoundValue(icon, sharp, path, out _);

        private const string HolderName = "pfm-value-holder";

        /// <summary>
        /// FM's condition or sharpness for the cell, from a hidden text bound to it; the text sits in
        /// a style setter running FM's own condition/sharpness table, so it also carries FM's colour.
        /// </summary>
        private static int? BoundValue(VisualElement icon, bool sharp, string path, out Color? fmColour)
        {
            fmColour = null;
            var parent = icon.parent;
            if (parent == null) return null;
            path ??= sharp ? "binding.Sharpness" : "player.Condition";
            SIText text = null;
            VisualElement holder = null;
            for (int i = 0; i < parent.childCount; i++)
            {
                if (parent[i].name == ValueName) { text = parent[i].TryCast<SIText>(); break; }
                if (parent[i].name == HolderName && parent[i].childCount > 0) { holder = parent[i]; text = parent[i][0].TryCast<SIText>(); break; }
            }
            if (text == null)
            {
                try
                {
                    text = new SIText { name = ValueName };
                    var method = new BindingMethod<SIText>();
                    method.m_kind = BindingMethodKind.Direct;
                    var direct = new DirectBinding();
                    direct.Path = new BindingPath(path);
                    method.m_direct = direct;
                    text.TextBinding = method;
                    text.pickingMode = PickingMode.Ignore;
                    holder = S.FmColours ? StyleSetter(HolderName, sharp ? StyleArgs(SharpnessTable, "StyleClass", path) : StyleArgs(ConditionTable, "TextColourStyle", path)) : null;
                    VisualElement hidden = (VisualElement)holder ?? text;
                    var st = hidden.style;
                    st.position = new StyleEnum<Position>(Position.Absolute);
                    st.width = new StyleLength(0f);
                    st.height = new StyleLength(0f);
                    st.opacity = new StyleFloat(0f);
                    st.overflow = new StyleEnum<Overflow>(Overflow.Hidden);
                    hidden.pickingMode = PickingMode.Ignore;
                    if (holder != null) { holder.Add(text); parent.Add(holder); try { holder.TryCast<SIStyleSetter>().BindToData(); } catch { } }
                    else parent.Add(text);
                    try { text.BindToData(); } catch { }
                }
                catch (Exception ex)
                {
                    if (!boundFailed) { boundFailed = true; Plugin.L.LogWarning("rings: can't read FM's value: " + ex.Message); }
                    return null;
                }
            }
            if (holder != null)
            {
                var cl = holder.GetClasses().TryCast<Il2CppSystem.Collections.Generic.List<string>>();
                if (cl != null && cl.Count > 0) fmColour = text.resolvedStyle.color;
            }
            var raw = text.text;
            if (string.IsNullOrEmpty(raw)) return null;
            var digits = new string(raw.Where(char.IsDigit).ToArray());
            if (digits.Length == 0 || digits.Length > 3) return null;
            if (!boundLogged) { boundLogged = true; Plugin.L.LogInfo($"rings: FM's {(sharp ? "sharpness" : "condition")} reads \"{raw}\""); }
            return int.Parse(digits, CultureInfo.InvariantCulture);
        }

        private static bool boundFailed, boundLogged;

        private static TextElement FirstTextElement(VisualElement e, int depth)
        {
            var t = e.TryCast<TextElement>();
            if (t != null) return t;
            if (depth > 4) return null;
            for (int i = 0; i < e.childCount; i++) { var r = FirstTextElement(e[i], depth + 1); if (r != null) return r; }
            return null;
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
            var w = new StyleFloat(S.TextOnly ? 0f : S.Border);
            s.borderTopWidth = w;
            s.borderBottomWidth = w;
            s.borderLeftWidth = w;
            s.borderRightWidth = w;
            s.alignItems = new StyleEnum<Align>(Align.Center);
            s.justifyContent = new StyleEnum<Justify>(Justify.Center);
            s.alignSelf = new StyleEnum<Align>(Align.Center);
            var label = new Label { name = "pfm-ring-label" };
            var ls = label.style;
            ls.fontSize = new StyleLength(S.TextOnly ? S.FontSize + 3f : S.FontSize);
            ls.unityFontStyleAndWeight = new StyleEnum<FontStyle>(S.Bold ? FontStyle.Bold : FontStyle.Normal);
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
            s.backgroundColor = new StyleColor(S.TextOnly ? Color.clear : new Color(colour.r, colour.g, colour.b, S.Fill));
            if (ring.childCount > 0)
            {
                var label = ring[0].TryCast<Label>();
                if (label != null)
                {
                    if (label.text != text) label.text = text;
                    // Text only: the number itself in the colour (a dot when the number is off)
                    label.style.color = new StyleColor(S.TextOnly ? colour : S.Text);
                    if (S.TextOnly && text.Length == 0) label.text = "●";
                }
            }
        }
    }
}
