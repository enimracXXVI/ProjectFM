using System;
using System.Collections.Generic;
using BepInEx.Logging;
using HarmonyLib;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.Dev
{
    /// <summary>
    /// Bookmarks test module (run by ProjectFM Dev Loader; F10 reloads it). FM caps the bookmarks
    /// under Continue with its own maximum and resets it whenever it works it out again. This
    /// hooks the places FM works it out so FM uses ours: it starts by showing all your bookmarks
    /// and takes one away while they do not fit in the smallest room seen on any screen (the
    /// longest tab row). The result is kept for labels on and for labels off. "(+N)" is
    /// corrected, and the bar is sized to its bookmarks so they stay on the right.
    /// </summary>
    public static class Entry
    {
        private static ManualLogSource L;
        private static Harmony harmony;
        private static float next;
        private const float Gap = 24f;
        private const int All = 12;               // "show them all" (FM shows fewer if you have fewer)

        private static int Max = -1;              // ours, given to FM
        private static int fmMax = 4;             // FM's own, learned when FM works it out
        private static float minRoom = float.MaxValue;
        private static int items;                 // bookmarks FM gives the bar now
        private static int lastCorrected = -1;
        private static readonly Dictionary<bool, int> capBy = new Dictionary<bool, int>(); // labels -> max
        private static bool? labels;              // labels mode in use
        private static bool? seen;                // last value read (FM flips it briefly)
        private static float seenSince;
        private static string lastLog;

        public static void Start(ManualLogSource log)
        {
            L = log;
            next = 0;
            L.LogInfo("dev bookmarks 0.11: bar opened up when FM cannot draw them all; \"(+N)\" checked every frame");
            try
            {
                harmony = new Harmony("projectfm.dev.bookmarks");
                foreach (var name in new[] { "UpdateMaxBookmarks", "TryUpdateMaxBookmarksWithLabels" })
                {
                    var m = AccessTools.Method(typeof(GameWorldTabsAndBookmarksModule), name);
                    if (m != null) harmony.Patch(m, postfix: new HarmonyMethod(typeof(Entry).GetMethod(nameof(AfterFm))));
                }
                var ind = AccessTools.Method(typeof(GameWorldTabsAndBookmarksModule), "UpdateBookmarkOverflowIndicator");
                if (ind != null) harmony.Patch(ind, postfix: new HarmonyMethod(typeof(Entry).GetMethod(nameof(AfterOverflow))));
                L.LogInfo("dev bookmarks: hooked FM's maximum and overflow count");
            }
            catch (Exception e) { L.LogWarning("dev bookmarks: hook: " + e); }
        }

        public static void Stop()
        {
            try { harmony?.UnpatchSelf(); } catch { }
            harmony = null;
            var m = Module();
            try { if (m != null) { m.m_currentMaxBookmarks.Value = fmMax; m.UpdateBookmarkOverflowIndicator(); } } catch { }
            Max = -1; fmMax = 4; minRoom = float.MaxValue; items = 0; lastCorrected = -1;
            capBy.Clear(); labels = null; seen = null; lastLog = null;
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
        }

        /// <summary>Right after FM has worked out its maximum: note FM's, put ours back.</summary>
        public static void AfterFm(GameWorldTabsAndBookmarksModule __instance)
        {
            try
            {
                var max = __instance.m_currentMaxBookmarks;
                if (max == null || Max < 0 || max.Value == Max) return;
                fmMax = max.Value;
                max.Value = Max;
            }
            catch { }
        }

        public static void AfterOverflow(GameWorldTabsAndBookmarksModule __instance)
        {
            try
            {
                var o = __instance.m_overflowingBookmarksCount;
                if (o != null && Max >= 0 && o.Value != lastCorrected) Correct(o);
            }
            catch { }
        }

        /// <summary>
        /// FM counts hidden bookmarks as your total less its own maximum. All shown (fewer than
        /// ours): none hidden. Otherwise your total less ours.
        /// </summary>
        private static void Correct(SI.Core.ValueWithChangeNotify<int> o)
        {
            int real = items > 0 && items < Max ? 0 : Math.Max(0, o.Value + fmMax - Max);
            lastCorrected = real;
            if (real != o.Value) o.Value = real;
        }

        private static void SetMax(GameWorldTabsAndBookmarksModule m, int value, string why)
        {
            if (value == Max) return;
            Max = value;
            L.LogInfo($"dev bookmarks: maximum {value} ({why})");
            try
            {
                var max = m.m_currentMaxBookmarks;
                if (max != null && max.Value != value) max.Value = value;
                m.UpdateBookmarkOverflowIndicator();
            }
            catch { }
        }

        private static float starvedSince = -1;

        /// <summary>The bar at the full room (or FM's own width), so FM can draw every bookmark.</summary>
        private static void Open(VisualElement area, VisualElement list)
        {
            float fixedParts = area.worldBound.width - list.worldBound.width;
            foreach (var e in new[] { area, list })
            {
                if (minRoom < float.MaxValue)
                {
                    float w = e == list ? minRoom : minRoom + fixedParts;
                    e.style.width = new StyleLength(w);
                    e.style.maxWidth = new StyleLength(w);
                    e.style.minWidth = new StyleLength(w);
                }
                else
                {
                    e.style.width = new StyleLength(StyleKeyword.Null);
                    e.style.maxWidth = new StyleLength(StyleKeyword.Null);
                    e.style.minWidth = new StyleLength(StyleKeyword.Null);
                }
            }
        }

        public static void Tick()
        {
            var m = Module();
            if (m == null) return;
            // Every frame: FM writes its own "(+N)" when screens change; ours replaces it at once
            try
            {
                var o = m.m_overflowingBookmarksCount;
                if (o != null && Max >= 0 && o.Value != lastCorrected) Correct(o);
            }
            catch { }
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            foreach (var root in Roots())
            {
                var area = Find(root, "Bookmarks");
                var list = area == null ? null : Find(area, "BookmarksList");
                var view = list == null ? null : Find(list, "View");
                if (area == null || view == null || area.worldBound.width <= 0) continue;

                // Labels on or off: act once FM's value has stayed the same for a second
                bool? now = null;
                try { now = m.m_areBookmarkLabelsVisible?.Value; } catch { }
                if (now != seen) { seen = now; seenSince = Time.realtimeSinceStartup; }
                if (now.HasValue && now != labels && Time.realtimeSinceStartup - seenSince > 1f)
                {
                    labels = now;
                    SetMax(m, capBy.TryGetValue(now.Value, out var c) ? c : All, $"labels {(now.Value ? "on" : "off")}");
                    Open(area, list); // the other mode's width no longer fits
                    continue;
                }
                if (!labels.HasValue) continue;
                if (Max < 0) { SetMax(m, All, "start"); continue; }

                try { items = list.TryCast<SI.Bindable.StreamedObjectList>()?.ItemCount ?? 0; } catch { }
                var widths = new List<float>();
                for (int i = 0; i < view.childCount; i++)
                    if (view[i].worldBound.width > 0) widths.Add(view[i].worldBound.width);
                if (items == 0) continue;
                if (widths.Count < items)
                {
                    // FM cannot draw them all in the bar as it is (labels just turned on): open it
                    if (starvedSince < 0) starvedSince = Time.realtimeSinceStartup;
                    else if (Time.realtimeSinceStartup - starvedSince > 0.6f)
                    {
                        starvedSince = -1;
                        bool full = minRoom < float.MaxValue && Math.Abs(list.worldBound.width - minRoom) < 4f;
                        // Already at the full room and still not all drawn: too many, one fewer
                        if (full && items > fmMax && items > 1)
                        {
                            SetMax(m, items - 1, "not all drawn in the full room");
                            if (labels.HasValue) capBy[labels.Value] = Max;
                        }
                        else Open(area, list);
                    }
                    continue;
                }
                starvedSince = -1;
                float sum = 8f; foreach (var w in widths) sum += w + 4f;
                float fixedParts = area.worldBound.width - list.worldBound.width;

                // The room on this screen: from the last tab (plus a gap) to the bar's right edge
                var tabs = Find(root, "SecondaryNavigationBarTabs");
                float lastRight = tabs == null ? 0 : RightmostTab(tabs);
                if (lastRight > 0)
                {
                    float room = area.worldBound.xMax - lastRight - Gap - fixedParts;
                    if (room > 50 && room < minRoom - 4f) minRoom = room;
                }

                // Too many for the room: one fewer (FM redraws; checked again next time)
                if (minRoom < float.MaxValue && sum > minRoom && items > fmMax && items > 1)
                {
                    SetMax(m, items - 1, $"{sum:0}px do not fit in {minRoom:0}px");
                    capBy[labels.Value] = Max;
                    continue;
                }
                capBy[labels.Value] = Max;

                // "(+N)" again when FM writes a new one (adding a bookmark)
                try
                {
                    var o = m.m_overflowingBookmarksCount;
                    if (o != null && o.Value != lastCorrected) Correct(o);
                }
                catch { }

                // The bar exactly as wide as its bookmarks, so they sit on the right by "(+N)"
                if (Math.Abs(sum - list.worldBound.width) >= 4f)
                    foreach (var (e, w) in new[] { (area, sum + fixedParts), (list, sum) })
                    {
                        e.style.width = new StyleLength(w);
                        e.style.maxWidth = new StyleLength(w);
                        e.style.minWidth = new StyleLength(w);
                    }
                string more = "";
                try { more = Find(area, "BookmarksText")?.TryCast<TextElement>()?.text ?? ""; } catch { }
                var msg = $"dev bookmarks: labels {(labels.Value ? "on" : "off")}, {items} shown, {sum:0}px, smallest room {minRoom:0}px, more '{more}'";
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

        private static GameWorldTabsAndBookmarksModule module_;

        private static GameWorldTabsAndBookmarksModule Module()
        {
            if (module_ != null) return module_;
            foreach (var m in Resources.FindObjectsOfTypeAll<GameWorldTabsAndBookmarksModule>()) { module_ = m; break; }
            return module_;
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
