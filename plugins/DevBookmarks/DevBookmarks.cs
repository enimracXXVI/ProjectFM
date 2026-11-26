using System;
using System.Collections.Generic;
using BepInEx.Logging;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.Dev
{
    /// <summary>
    /// Bookmarks test module (run by ProjectFM Dev Loader; F10 reloads it). FM gives the bookmark
    /// bar under Continue a fixed width and counts the rest as "(+N)". This widens the bar into
    /// the free space after the last tab of the second bar, keeping a gap, and follows it as
    /// the tabs change from screen to screen.
    /// </summary>
    public static class Entry
    {
        private static ManualLogSource L;
        private static float next;
        private static float origArea = -1, origList = -1, extra;
        private const float Gap = 24f;
        private static string lastLog;

        public static void Start(ManualLogSource log) { L = log; next = 0; L.LogInfo("dev bookmarks 0.1: widen the bookmark bar into the free space"); }

        public static void Stop()
        {
            // Give FM its own widths back
            foreach (var root in Roots())
            {
                var area = Find(root, "Bookmarks");
                var list = area == null ? null : Find(area, "BookmarksList");
                if (area != null) area.style.width = new StyleLength(StyleKeyword.Null);
                if (list != null) list.style.width = new StyleLength(StyleKeyword.Null);
            }
            origArea = origList = -1;
            extra = 0;
        }

        public static void Tick()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            foreach (var root in Roots())
            {
                var area = Find(root, "Bookmarks");
                var list = area == null ? null : Find(area, "BookmarksList");
                var tabs = Find(root, "SecondaryNavigationBarTabs");
                if (area == null || list == null || tabs == null) continue;
                if (area.worldBound.width <= 0) continue;
                if (origArea < 0)
                {
                    origArea = area.resolvedStyle.width;
                    origList = list.resolvedStyle.width;
                    L.LogInfo($"dev bookmarks: FM's widths: area {origArea:0}px, list {origList:0}px");
                }
                float lastRight = RightmostTab(tabs);
                if (lastRight <= 0) continue;
                float free = area.worldBound.xMin - lastRight - Gap;
                if (Math.Abs(free) < 4f) continue;
                extra = Math.Max(0f, extra + free);
                area.style.width = new StyleLength(origArea + extra);
                list.style.width = new StyleLength(origList + extra);
                var msg = $"dev bookmarks: last tab ends at {lastRight:0}px, bar now {origArea + extra:0}px (+{extra:0}px)";
                if (msg != lastLog) { lastLog = msg; L.LogInfo(msg); }
            }
        }

        /// <summary>Where the second bar's last visible tab (or its More button) ends.</summary>
        private static float RightmostTab(VisualElement tabs)
        {
            float right = 0;
            void Walk(VisualElement e, int depth)
            {
                if (depth > 30) return;
                bool shown;
                try { shown = e.resolvedStyle.display != DisplayStyle.None && e.resolvedStyle.visibility == Visibility.Visible; }
                catch { shown = true; }
                if (!shown) return;
                if (e.ClassListContains("streamed-object-list-item") || e.name == "SecondaryTabDropdownButton")
                {
                    var b = e.worldBound;
                    if (b.width > 0 && b.xMax > right) right = b.xMax;
                    return;
                }
                for (int i = 0; i < e.childCount; i++) Walk(e[i], depth + 1);
            }
            Walk(tabs, 0);
            return right;
        }

        private static IEnumerable<VisualElement> Roots()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
                if (doc.rootVisualElement != null) yield return doc.rootVisualElement;
        }

        private static VisualElement Find(VisualElement e, string name, int depth = 0)
        {
            if (e.name == name) return e;
            if (depth > 60) return null;
            for (int i = 0; i < e.childCount; i++)
            {
                var r = Find(e[i], name, depth + 1);
                if (r != null) return r;
            }
            return null;
        }
    }
}
