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
    [BepInPlugin("projectfm.training", "ProjectFM Training", "1.2.0")]
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
    /// with width-30-percent); it gets the width from the settings. Praise / Criticise buttons go on
    /// each player's row and above the list (for the ticked players); each one walks FM's own
    /// right-click menu for the player: Interaction > Praise > Praise Training/Development, or
    /// Interaction > Warn > Criticise Training/Development, so FM does exactly what it does there.
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
            try { Actions.Step(); } catch (Exception e) { Plugin.L.LogWarning("training: action: " + e.Message); Actions.Abort(); }
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

        [HideFromIl2Cpp]
        private static void AddButtons(VisualElement list)
        {
            // Above each table, before FM's Filter button: for the ticked players
            foreach (var filter in FindAll(list, "Filter"))
            {
                var header = filter.parent;
                if (header == null) continue;
                var top = Child(header, TopMark);
                if (Settings.TopButtons && top == null)
                {
                    top = Pair(TopMark, "Praise ticked", "Criticise ticked", true, null);
                    header.Insert(header.IndexOf(filter), top);
                }
                else if (top != null && !Settings.TopButtons) top.RemoveFromHierarchy();
            }

            // On each row, after the player's name
            foreach (var row in Rows(list))
            {
                var player = Find(row, "RightClickMenuBinding", 0);
                var cell = player == null ? null : Up(player, "streamed-table__cell");
                var holder = cell == null ? null : FindClass(cell, "data_display-table-cell-default-default-type-3---thumbnail-primary-and-secondary-thumbnail-player-and-desc-space-spacious-accent-false-orientation-vertical-selected-false", 0) ?? (cell.childCount > 0 ? cell[0] : null);
                if (holder == null) continue;
                var mine = Child(holder, RowMark);
                if (!Settings.RowButtons) { mine?.RemoveFromHierarchy(); continue; }
                if (mine == null) holder.Add(Pair(RowMark, "Praise", "Criticise", false, holder));
            }
        }

        [HideFromIl2Cpp]
        private static VisualElement Pair(string name, string praise, string criticise, bool ticked, VisualElement rowCell)
        {
            var box = new VisualElement { name = name };
            box.style.flexDirection = FlexDirection.Row;
            box.style.alignSelf = Align.Center;
            box.style.flexShrink = 0f;
            box.style.marginLeft = 6;
            box.style.marginRight = 6;
            box.Add(MakeButton(praise, new Color(0.20f, 0.66f, 0.33f), () => Clicked(true, ticked, box)));
            box.Add(MakeButton(criticise, new Color(0.80f, 0.26f, 0.21f), () => Clicked(false, ticked, box)));
            return box;
        }

        [HideFromIl2Cpp]
        private static Button MakeButton(string text, Color colour, Action click)
        {
            var b = new Button();
            b.text = text;
            b.add_clicked((Il2CppSystem.Action)click);
            var st = b.style;
            st.backgroundColor = new Color(colour.r, colour.g, colour.b, 0.85f);
            st.color = Color.white;
            st.fontSize = 11;
            st.unityFontStyleAndWeight = FontStyle.Bold;
            st.paddingLeft = 6; st.paddingRight = 6; st.paddingTop = 2; st.paddingBottom = 2;
            st.marginLeft = 2; st.marginRight = 2;
            st.borderTopLeftRadius = 4; st.borderTopRightRadius = 4; st.borderBottomLeftRadius = 4; st.borderBottomRightRadius = 4;
            st.borderTopWidth = 0; st.borderBottomWidth = 0; st.borderLeftWidth = 0; st.borderRightWidth = 0;
            return b;
        }

        [HideFromIl2Cpp]
        private static void Clicked(bool praise, bool ticked, VisualElement from)
        {
            var targets = new List<VisualElement>();
            if (ticked)
            {
                // The table under this header: the nearest parent that holds rows
                VisualElement scope = from.parent;
                for (int i = 0; i < 6 && scope != null && Rows(scope).Count == 0; i++) scope = scope.parent;
                foreach (var row in Rows(scope))
                {
                    var cell = FindClass(row, "streamed-table__cell", 0);
                    var t = cell == null ? null : FindType<Toggle>(cell);
                    if (t != null && t.value && row.resolvedStyle.display != DisplayStyle.None) targets.Add(row);
                }
                if (targets.Count == 0) { Plugin.L.LogInfo("training: no players ticked"); return; }
            }
            else
            {
                var row = Up(from, "streamed-table__row");
                if (row != null) targets.Add(row);
            }
            Actions.Start(praise, targets);
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

    /// <summary>
    /// Walks FM's right-click menu for one player after another: opens it on the player's picture
    /// (FM's own right-click target), then picks Interaction, Praise or Warn, and the
    /// Training/Development entry, waiting for each folder to appear.
    /// </summary>
    internal static class Actions
    {
        private static readonly Queue<VisualElement> queue = new();
        private static bool praise;
        private static int step;          // 0 idle, 1 opening, 2 interaction, 3 praise/warn, 4 item, 5 pause
        private static float deadline, wait;
        private static string who = "";
        private static int done, missed;

        public static void Start(bool doPraise, List<VisualElement> rows)
        {
            if (step != 0) { Plugin.L.LogInfo("training: still busy with the last click"); return; }
            praise = doPraise;
            queue.Clear();
            foreach (var r in rows) queue.Enqueue(r);
            done = missed = 0;
            Plugin.L.LogInfo($"training: {(praise ? "praising" : "criticising")} training/development for {rows.Count} player(s)");
            NextPlayer();
        }

        public static void Abort()
        {
            CloseMenus();
            queue.Clear();
            step = 0;
        }

        private static void NextPlayer()
        {
            if (queue.Count == 0)
            {
                if (step != 0) Plugin.L.LogInfo($"training: done ({done} done, {missed} not offered by FM)");
                step = 0;
                return;
            }
            var row = queue.Dequeue();
            var target = Runner.Find(row, "RightClickMenuBinding", 0);
            var name = Runner.Find(row, "primary-text", 0)?.TryCast<TextElement>()?.text ?? "?";
            who = System.Text.RegularExpressions.Regex.Replace(name, "<[^>]+>", "");
            if (target == null) { Plugin.L.LogWarning($"training: no right-click spot for {who}"); missed++; NextPlayer(); return; }
            RightClick(target);
            step = 2;
            deadline = Time.realtimeSinceStartup + 2f;
        }

        public static void Step()
        {
            if (step == 0) return;
            if (step == 5) { if (Time.realtimeSinceStartup >= wait) { step = 1; NextPlayer(); } return; }
            string want = step == 2 ? "Interaction" : step == 3 ? (praise ? "Praise" : "Warn") : null;
            var entry = step == 4 ? FindEntry(t => t.Contains("Training") && (praise ? t.StartsWith("Praise") : t.StartsWith("Critici"))) : FindEntry(t => t == want);
            if (entry != null)
            {
                Select(entry);
                if (step == 4) { done++; Plugin.L.LogInfo($"training: {who}: done"); Pause(); }
                else { step++; deadline = Time.realtimeSinceStartup + 2f; }
                return;
            }
            if (Time.realtimeSinceStartup > deadline)
            {
                Plugin.L.LogInfo($"training: {who}: FM did not offer {(step == 4 ? (praise ? "Praise Training/Development" : "Criticise Training/Development") : want)}");
                missed++;
                CloseMenus();
                Pause();
            }
        }

        private static void Pause() { step = 5; wait = Time.realtimeSinceStartup + 0.6f; }

        private static void RightClick(VisualElement target)
        {
            var pos = target.worldBound.center;
            var down = new Event { type = EventType.MouseDown, button = 1, mousePosition = pos, clickCount = 1 };
            var up = new Event { type = EventType.MouseUp, button = 1, mousePosition = pos, clickCount = 1 };
            target.SendEvent(PointerDownEvent.GetPooled(down));
            target.SendEvent(MouseDownEvent.GetPooled(down));
            target.SendEvent(PointerUpEvent.GetPooled(up));
            target.SendEvent(MouseUpEvent.GetPooled(up));
            target.SendEvent(ContextClickEvent.GetPooled(up));
        }

        private static void Select(VisualElement entry)
        {
            var e = entry.TryCast<SI.UI.CascadingMenu.EntryElement>();
            if (e != null) { e.HandleSelection(); return; }
            entry.SendEvent(NavigationSubmitEvent.GetPooled());
        }

        private static VisualElement FindEntry(Func<string, bool> match)
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
            {
                var root = doc.rootVisualElement;
                if (root == null) continue;
                var r = Walk(root, match, 0);
                if (r != null) return r;
            }
            return null;
        }

        private static VisualElement Walk(VisualElement e, Func<string, bool> match, int depth)
        {
            if (e.ClassListContains("plugin-context-menu-entry-text"))
            {
                var t = e.TryCast<TextElement>()?.text;
                if (t != null && match(t.Trim()))
                    return Runner.Up(e, "cascading-menu__folder__entry");
                return null;
            }
            if (depth > 60 || e.resolvedStyle.display == DisplayStyle.None) return null;
            for (int i = 0; i < e.childCount; i++) { var r = Walk(e[i], match, depth + 1); if (r != null) return r; }
            return null;
        }

        private static void CloseMenus()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
            {
                var root = doc.rootVisualElement;
                if (root == null) continue;
                foreach (var m in root.Query<SI.UI.CascadingMenu>((string)null, (string)null).ToList())
                    try { m.ClearFolderStack(); } catch { }
            }
        }
    }
}
