using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Attributes;
using Il2CppInterop.Runtime.Injection;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.Training
{
    [BepInPlugin("projectfm.training", "ProjectFM Training", "2.1.1")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            Settings.Load();
            ClassInjector.RegisterTypeInIl2Cpp<Runner>();
            AddComponent<Runner>();
            L.LogInfo($"training: loaded (player list {Settings.ListWidth:0}% wide)");
        }
    }

    /// <summary>Training.cfg next to the plugin.</summary>
    internal static class Settings
    {
        public static float ListWidth = 45f;
        public static bool RowButtons = true, TopButtons = true;
        public static Color PraiseColour = new Color(0.20f, 0.66f, 0.33f), CriticiseColour = new Color(0.80f, 0.26f, 0.21f);
        private static readonly string Path = System.IO.Path.Combine(
            System.IO.Path.GetDirectoryName(typeof(Settings).Assembly.Location) ?? Paths.PluginPath, "Training.cfg");
        private static DateTime stamp;

        public static void Load()
        {
            try
            {
                if (!File.Exists(Path))
                    File.WriteAllLines(Path, new[]
                    {
                        "# ProjectFM Training. Edit while FM runs: applied within 2 seconds.",
                        "# Individual training: width of the player list, in % of the block (FM's own is 30)",
                        "ListWidth = 45",
                        "# Praise / Criticise Training/Development buttons on each player's row, and above the list for the ticked players",
                        "RowButtons = true",
                        "TopButtons = true",
                        "# Button colours (#RRGGBB)",
                        "PraiseColour = #33A854",
                        "CriticiseColour = #CC4236",
                    });
                stamp = File.GetLastWriteTimeUtc(Path);
                foreach (var raw in File.ReadAllLines(Path))
                {
                    var line = raw.Trim();
                    if (line.StartsWith("#")) continue;
                    int eq = line.IndexOf('=');
                    if (eq < 0) continue;
                    var k = line.Substring(0, eq).Trim().ToLowerInvariant();
                    var v = line.Substring(eq + 1).Trim();
                    bool on = v.Equals("true", StringComparison.OrdinalIgnoreCase) || v == "1" || v.Equals("yes", StringComparison.OrdinalIgnoreCase);
                    if (k == "rowbuttons") RowButtons = on;
                    if ((k == "praisecolour" || k == "criticisecolour") && ColorUtility.TryParseHtmlString(v, out var c)) { if (k == "praisecolour") PraiseColour = c; else CriticiseColour = c; }
                    if (k == "topbuttons") TopButtons = on;
                    if (k == "listwidth" && float.TryParse(v.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var n))
                        ListWidth = Math.Clamp(n, 15f, 85f);
                }
            }
            catch (Exception e) { Plugin.L.LogWarning("training: settings: " + e.Message); }
        }

        public static void Reload()
        {
            try { if (File.Exists(Path) && File.GetLastWriteTimeUtc(Path) != stamp) Load(); } catch { }
        }
    }

    /// <summary>
    /// Individual training screen. FM gives the player list 30% of the block (a ComponentElement
    /// with width-30-percent); it gets the width from the settings. FM's own Praise / Criticise
    /// Training/Development action buttons (FMActionButton with FM's action ids) go on each
    /// player's row and above each table for FM's ticked players, so a click opens FM's
    /// conversation directly.
    /// </summary>
    public class Runner : MonoBehaviour
    {
        public Runner(IntPtr ptr) : base(ptr) { }
        private const string RowMark = "pfm-train-row", TopMark = "pfm-train-top";
        private float next, nextCfg;
        private int errors;
        private bool told;

        private void Update()
        {
            if (Time.realtimeSinceStartup >= nextCfg) { nextCfg = Time.realtimeSinceStartup + 2f; Settings.Reload(); }
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            try
            {
                foreach (var doc in FindObjectsOfType<UIDocument>())
                {
                    var root = doc.rootVisualElement;
                    if (root == null) continue;
                    var block = Find(root, "IndividualTrainingBlock", 0);
                    if (block == null) continue;
                    var list = FindClass(block, "width-30-percent", 0);
                    if (list != null)
                    {
                        list.style.width = new StyleLength(new Length(Settings.ListWidth, LengthUnit.Percent));
                        list.style.flexShrink = new StyleFloat(0f);
                        if (!told) { told = true; Plugin.L.LogInfo($"training: player list widened to {Settings.ListWidth:0}%"); }
                    }
                    // Detailed and Summary views: each has its own Filter header and table
                    AddButtons(block);
                }
                errors = 0;
            }
            catch (Exception e) { if (++errors <= 3) Plugin.L.LogWarning("training: " + e.Message); }
        }

        // FM's own actions, as its PraisePlayerTrainingDevelopmentButtonCell and
        // WarnPlayerTrainingDevelopmentButtonCell use them (the MrTini23 skin places the same)
        private const uint PraiseAction = 1800548932, CriticiseAction = 544892514;

        [HideFromIl2Cpp]
        private static void AddButtons(VisualElement list)
        {
            // Above each table, before FM's Filter button: FM's buttons for its ticked players
            // ("selectedlist" is the training block's own list of selected players)
            foreach (var filter in FindAll(list, "Filter"))
            {
                var header = filter.parent;
                if (header == null) continue;
                var top = Child(header, TopMark);
                if (Settings.TopButtons && top == null)
                {
                    top = Pair(TopMark, "selectedlist");
                    header.Insert(header.IndexOf(filter), top);
                    Bind(top);
                }
                else if (top != null && !Settings.TopButtons) top.RemoveFromHierarchy();
                if (top != null && top.parent != null) Compact(top);
            }

            // On each row, after the player's name: FM's buttons for that row's player
            foreach (var row in Rows(list))
            {
                var player = Find(row, "RightClickMenuBinding", 0);
                var cell = player == null ? null : Up(player, "streamed-table__cell");
                var holder = cell == null ? null : (cell.childCount > 0 ? cell[0] : null);
                if (holder == null) continue;
                var mine = Child(holder, RowMark);
                if (!Settings.RowButtons) { mine?.RemoveFromHierarchy(); continue; }
                if (mine == null)
                {
                    mine = Pair(RowMark, "binding");
                    holder.Add(mine);
                    Bind(mine);
                }
                Compact(mine);
            }
        }

        /// <summary>FM's Praise and Criticise Training/Development buttons for the players at a path.</summary>
        [HideFromIl2Cpp]
        private static VisualElement Pair(string name, string records)
        {
            var box = new VisualElement { name = name };
            box.style.flexDirection = FlexDirection.Row;
            box.style.alignSelf = Align.Center;
            box.style.alignItems = Align.Center;
            box.style.flexShrink = 0f;
            box.style.marginLeft = 6;
            box.style.marginRight = 6;
            foreach (var id in new[] { PraiseAction, CriticiseAction })
            {
                var b = new FM.UI.FMActionButton();
                b.ActionId = (FM.GamePlugin.ActionID)id;
                b.RecordsBinding = new SI.Bindable.BindingPath(records);
                b.ShowOnlyFirstButton = true;
                b.style.marginLeft = 2;
                b.style.marginRight = 2;
                box.Add(b);
            }
            return box;
        }

        private static void Bind(VisualElement box)
        {
            for (int i = 0; i < box.childCount; i++)
            {
                var b = box[i].TryCast<FM.UI.FMActionButton>();
                try { b?.BindToData(); } catch (Exception e) { Plugin.L.LogWarning("training: button: " + e.Message); }
            }
            if (!toldButtons) { toldButtons = true; Plugin.L.LogInfo("training: FM's praise/criticise buttons added"); }
        }

        private static bool toldButtons;

        /// <summary>
        /// FM draws each button with its icon and "Praise/Criticise Training/Development": only the
        /// icon is kept, on green (praise) or red (criticise); FM's full text stays as the tooltip.
        /// </summary>
        private static void Compact(VisualElement box)
        {
            for (int i = 0; i < box.childCount; i++)
            {
                var action = box[i];
                var colour = i == 0 ? Settings.PraiseColour : Settings.CriticiseColour;
                Style(action, colour, 0);
            }
        }

        private static void Style(VisualElement e, Color colour, int depth)
        {
            if (depth > 30) return;
            var text = e.TryCast<TextElement>();
            if (text != null && !string.IsNullOrEmpty(text.text))
            {
                if (e.childCount == 0)
                {
                    // FM's label: hidden, kept as the button's tooltip
                    if (e.parent != null && string.IsNullOrEmpty(e.parent.tooltip)) e.parent.tooltip = text.text;
                    e.style.display = DisplayStyle.None;
                }
                else
                {
                    // A button that carries the label itself: no text, the icon child stays
                    if (string.IsNullOrEmpty(e.tooltip)) e.tooltip = text.text;
                    text.text = "";
                }
            }
            var n = e.name ?? "";
            if (e.ClassListContains("sibutton") || e.ClassListContains("unity-button") || e.TryCast<Button>() != null || n.IndexOf("button", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                var st = e.style;
                st.backgroundColor = colour;
                var b = new StyleColor(colour);
                st.borderTopColor = b; st.borderBottomColor = b; st.borderLeftColor = b; st.borderRightColor = b;
                st.paddingLeft = 4; st.paddingRight = 4; st.paddingTop = 2; st.paddingBottom = 2;
                st.minWidth = 0; st.width = StyleKeyword.Auto;
                st.flexGrow = 0; st.flexShrink = 0;
                st.marginLeft = 1; st.marginRight = 1;
            }
            for (int i = 0; i < e.childCount; i++) Style(e[i], colour, depth + 1);
        }

        [HideFromIl2Cpp]
        internal static List<VisualElement> Rows(VisualElement e)
        {
            var acc = new List<VisualElement>();
            void Walk(VisualElement x, int d)
            {
                if (x.ClassListContains("streamed-table__row")) { acc.Add(x); return; }
                if (d > 30) return;
                for (int i = 0; i < x.childCount; i++) Walk(x[i], d + 1);
            }
            if (e != null) Walk(e, 0);
            return acc;
        }

        [HideFromIl2Cpp]
        internal static T FindType<T>(VisualElement e, int depth = 0) where T : VisualElement
        {
            var t = e.TryCast<T>();
            if (t != null) return t;
            if (depth > 12) return null;
            for (int i = 0; i < e.childCount; i++) { var r = FindType<T>(e[i], depth + 1); if (r != null) return r; }
            return null;
        }

        [HideFromIl2Cpp]
        internal static List<VisualElement> FindAll(VisualElement e, string name, List<VisualElement> acc = null, int depth = 0)
        {
            acc ??= new List<VisualElement>();
            if (e.name == name) { acc.Add(e); return acc; }
            if (depth > 40) return acc;
            for (int i = 0; i < e.childCount; i++) FindAll(e[i], name, acc, depth + 1);
            return acc;
        }

        internal static VisualElement Up(VisualElement e, string cls)
        {
            for (var p = e; p != null; p = p.parent) if (p.ClassListContains(cls)) return p;
            return null;
        }

        internal static VisualElement Child(VisualElement e, string name)
        {
            for (int i = 0; i < e.childCount; i++) if (e[i].name == name) return e[i];
            return null;
        }

        internal static VisualElement Find(VisualElement e, string name, int depth)
        {
            if (e.name == name) return e;
            if (depth > 40) return null;
            for (int i = 0; i < e.childCount; i++) { var r = Find(e[i], name, depth + 1); if (r != null) return r; }
            return null;
        }

        internal static VisualElement FindClass(VisualElement e, string cls, int depth)
        {
            if (e.ClassListContains(cls)) return e;
            if (depth > 12) return null;
            for (int i = 0; i < e.childCount; i++) { var r = FindClass(e[i], cls, depth + 1); if (r != null) return r; }
            return null;
        }
    }
}
