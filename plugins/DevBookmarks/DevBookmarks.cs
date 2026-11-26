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

        private static int settle;
        private static float recountAt;

        public static void Start(ManualLogSource log)
        {
            // Clear whatever an earlier version set, and read FM's widths only once it has
            // laid the bar out again without them
            Reset();
            settle = 2;
            L = log; next = 0; L.LogInfo("dev bookmarks 0.4: raise FM's CurrentMaxBookmarks to what fits, bar sized to the bookmarks"); }

        public static void Stop()
        {
            Reset();
            // FM's own maximum back
            try { if (fmMax >= 0 && module_ != null) module_.m_currentMaxBookmarks.Value = fmMax; } catch { }
            fmMax = -1;
        }

        private static void Reset()
        {
            // Give FM its own widths back
            foreach (var root in Roots())
            {
                var area = Find(root, "Bookmarks");
                var list = area == null ? null : Find(area, "BookmarksList");
                foreach (var e in new[] { area, list })
                {
                    if (e == null) continue;
                    e.style.width = new StyleLength(StyleKeyword.Null);
                    e.style.maxWidth = new StyleLength(StyleKeyword.Null);
                    e.style.minWidth = new StyleLength(StyleKeyword.Null);
                }
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
                if (settle > 0) { settle--; continue; }
                if (origArea < 0)
                {
                    origArea = area.resolvedStyle.width;
                    origList = list.resolvedStyle.width;
                    L.LogInfo($"dev bookmarks: FM's widths: area {origArea:0}px, list {origList:0}px");
                }
                float lastRight = RightmostTab(tabs);
                if (lastRight <= 0) continue;
                // How many fit: the free space from the last tab (plus a gap) to the bar's right
                // edge, less the bar's own parts ("(+N)", the arrow), over the bookmarks' width
                var view = Find(list, "View");
                var widths = new List<float>();
                if (view != null)
                    for (int i = 0; i < view.childCount; i++)
                        if (view[i].worldBound.width > 0) widths.Add(view[i].worldBound.width);
                if (widths.Count == 0) continue;
                float avg = 0; foreach (var w in widths) avg += w; avg /= widths.Count;
                float fixedParts = area.worldBound.width - list.worldBound.width;
                float room = area.worldBound.xMax - lastRight - Gap - fixedParts;
                var module = Module();
                if (module == null) continue;
                int total = Total(module);
                int fit = Math.Max(1, (int)Math.Floor(room / (avg + 4f)));
                int want = total > 0 ? Math.Min(fit, total) : fit;
                var max = module.m_currentMaxBookmarks;
                if (max != null && want != max.Value)
                {
                    int before = max.Value;
                    if (fmMax < 0) fmMax = before;
                    // Through FM's own value, which tells the bookmark bar it changed
                    max.Value = want;
                    try { module.UpdateBookmarkOverflowIndicator(); } catch (Exception e) { L.LogWarning("dev bookmarks: overflow: " + e.Message); }
                    L.LogInfo($"dev bookmarks: room {room:0}px, bookmark ~{avg:0}px: max bookmarks {before} -> {want} (of {total})");
                    recountAt = Time.realtimeSinceStartup + 1f;
                }
                // The bar as wide as its bookmarks, so they stay on the right by "(+N)"
                float sum = 8f; foreach (var w in widths) sum += w + 4f;
                float listW = Math.Min(sum, Math.Max(room, origList));
                if (Math.Abs(listW - extra) < 4f) continue;
                extra = listW;
                foreach (var (e, w) in new[] { (area, listW + fixedParts), (list, listW) })
                {
                    e.style.width = new StyleLength(w);
                    e.style.maxWidth = new StyleLength(w);
                    e.style.minWidth = new StyleLength(w);
                }
                var msg = $"dev bookmarks: last tab ends at {lastRight:0}px, list set to {listW:0}px; {Counts(area, list)}";
                if (msg != lastLog) { lastLog = msg; L.LogInfo(msg); }
            }
        }

        private static GameWorldTabsAndBookmarksModule module_;
        private static int fmMax = -1;

        private static GameWorldTabsAndBookmarksModule Module()
        {
            if (module_ != null) return module_;
            foreach (var m in Resources.FindObjectsOfTypeAll<GameWorldTabsAndBookmarksModule>()) { module_ = m; break; }
            if (module_ == null) L.LogWarning("dev bookmarks: FM's bookmarks module not found");
            return module_;
        }

        /// <summary>How many bookmarks you have chosen (shown plus behind "(+N)").</summary>
        private static int Total(GameWorldTabsAndBookmarksModule m)
        {
            try { return m.CurrentSelectedBookmarksList.Value.Bookmarks.Count; } catch { }
            return 0;
        }

        /// <summary>Asks FM's list to lay its bookmarks out again for the new width.</summary>
        private static void Refresh(VisualElement list)
        {
            try
            {
                var v = Find(list, "VirtualisedList") ?? FirstOfType(list, "VirtualisedList");
                var vl = v?.TryCast<SI.UI.VirtualisedList>();
                vl?.Controller?.Refresh();
            }
            catch (Exception e) { L.LogWarning("dev bookmarks: refresh: " + e.Message); }
        }

        private static VisualElement FirstOfType(VisualElement e, string type, int depth = 0)
        {
            try { if (e.GetIl2CppType().Name == type) return e; } catch { }
            if (depth > 10) return null;
            for (int i = 0; i < e.childCount; i++)
            {
                var r = FirstOfType(e[i], type, depth + 1);
                if (r != null) return r;
            }
            return null;
        }

        /// <summary>How many bookmarks FM gives the list, how many it draws, and its "(+N)".</summary>
        private static string Counts(VisualElement area, VisualElement list)
        {
            string items = "?", drawn = "?", more = "?";
            try { items = list.TryCast<SI.Bindable.StreamedObjectList>()?.ItemCount.ToString() ?? "?"; } catch { }
            try { drawn = (Find(list, "View")?.childCount ?? -1).ToString(); } catch { }
            try { more = Find(area, "BookmarksText")?.TryCast<TextElement>()?.text ?? "(none)"; } catch { }
            return $"bookmarks in the list {items}, drawn {drawn}, more text {more}";
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
