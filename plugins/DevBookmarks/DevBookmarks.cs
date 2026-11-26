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
    /// under Continue with its own maximum (4 at the user's resolution) and resets it whenever it
    /// works it out again. This hooks the two places FM works it out, so FM itself uses the higher
    /// number: it draws once, counts the hidden ones ("+N") itself, and nothing redraws per screen.
    /// The bar is then sized once to its bookmarks, so they stay on the right.
    /// </summary>
    public static class Entry
    {
        private static ManualLogSource L;
        private static Harmony harmony;
        private static float next;
        private static int fmMax = -1;
        private static string lastLog;

        /// <summary>How many bookmarks FM may show (it shows fewer when you have fewer).</summary>
        private const int Max = 8;

        public static void Start(ManualLogSource log)
        {
            L = log;
            next = 0;
            L.LogInfo("dev bookmarks 0.6: also corrects FM's \"(+N)\" count");
            try
            {
                harmony = new Harmony("projectfm.dev.bookmarks");
                var post = new HarmonyMethod(typeof(Entry).GetMethod(nameof(AfterFm)));
                foreach (var name in new[] { "UpdateMaxBookmarks", "TryUpdateMaxBookmarksWithLabels" })
                {
                    var m = AccessTools.Method(typeof(GameWorldTabsAndBookmarksModule), name);
                    if (m == null) { L.LogWarning($"dev bookmarks: FM's {name} not found"); continue; }
                    harmony.Patch(m, postfix: post);
                    L.LogInfo($"dev bookmarks: hooked FM's {name}");
                }
                var ind = AccessTools.Method(typeof(GameWorldTabsAndBookmarksModule), "UpdateBookmarkOverflowIndicator");
                if (ind != null)
                {
                    harmony.Patch(ind, postfix: new HarmonyMethod(typeof(Entry).GetMethod(nameof(AfterOverflow))));
                    L.LogInfo("dev bookmarks: hooked FM's UpdateBookmarkOverflowIndicator");
                }
            }
            catch (Exception e) { L.LogWarning("dev bookmarks: hook: " + e); }
            Apply(Module());
            try { Module()?.UpdateBookmarkOverflowIndicator(); } catch { }
        }

        public static void Stop()
        {
            try { harmony?.UnpatchSelf(); } catch { }
            harmony = null;
            var m = Module();
            try { if (fmMax >= 0 && m != null) { m.m_currentMaxBookmarks.Value = fmMax; m.UpdateBookmarkOverflowIndicator(); } } catch { }
            fmMax = -1;
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

        /// <summary>Runs right after FM has worked out its maximum: ours replaces it.</summary>
        public static void AfterFm(GameWorldTabsAndBookmarksModule __instance)
        {
            try { Apply(__instance); } catch { }
        }

        /// <summary>
        /// FM counts the hidden bookmarks against its own maximum (4), not the one it uses: with
        /// 6 bookmarks all shown it still said "(+2)". The real count is that less the extra room.
        /// </summary>
        public static void AfterOverflow(GameWorldTabsAndBookmarksModule __instance)
        {
            try
            {
                var o = __instance.m_overflowingBookmarksCount;
                if (o == null || fmMax < 0) return;
                int real = Math.Max(0, o.Value - (Max - fmMax));
                if (real != o.Value) o.Value = real;
            }
            catch { }
        }

        private static void Apply(GameWorldTabsAndBookmarksModule m)
        {
            var max = m?.m_currentMaxBookmarks;
            if (max == null || max.Value == Max) return;
            fmMax = max.Value;
            max.Value = Max;
            try { m.UpdateBookmarkOverflowIndicator(); } catch { }
        }

        public static void Tick()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            foreach (var root in Roots())
            {
                var area = Find(root, "Bookmarks");
                var list = area == null ? null : Find(area, "BookmarksList");
                var view = list == null ? null : Find(list, "View");
                if (area == null || view == null || area.worldBound.width <= 0) continue;
                int items = 0;
                try { items = list.TryCast<SI.Bindable.StreamedObjectList>()?.ItemCount ?? 0; } catch { }
                var widths = new List<float>();
                for (int i = 0; i < view.childCount; i++)
                    if (view[i].worldBound.width > 0) widths.Add(view[i].worldBound.width);
                if (items == 0 || widths.Count == 0) continue;
                float fixedParts = area.worldBound.width - list.worldBound.width;
                float target;
                if (widths.Count < items)
                {
                    // Not all drawn yet: room for all of them, at the widest one's width
                    float widest = 0; foreach (var w in widths) widest = Math.Max(widest, w);
                    target = items * (widest + 4f) + 8f;
                }
                else
                {
                    // All drawn: exactly their width, so they sit on the right by "(+N)"
                    target = 8f; foreach (var w in widths) target += w + 4f;
                }
                if (Math.Abs(target - list.worldBound.width) < 4f) continue;
                foreach (var (e, w) in new[] { (area, target + fixedParts), (list, target) })
                {
                    e.style.width = new StyleLength(w);
                    e.style.maxWidth = new StyleLength(w);
                    e.style.minWidth = new StyleLength(w);
                }
                string more = "?";
                try { more = Find(area, "BookmarksText")?.TryCast<TextElement>()?.text ?? ""; } catch { }
                var msg = $"dev bookmarks: {items} bookmarks, {widths.Count} drawn, bar {target:0}px, more text '{more}'";
                if (msg != lastLog) { lastLog = msg; L.LogInfo(msg); }
            }
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
