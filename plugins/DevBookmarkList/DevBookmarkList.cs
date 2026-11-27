using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using BepInEx.Logging;
using UnityEngine;

namespace ProjectFM.Dev
{
    /// <summary>
    /// Bookmark list probe (run by ProjectFM Dev Loader). Writes FM's bookmark lists (every
    /// bookmark FM offers under All Bookmarks, with what each opens) to bookmarks.txt next to the
    /// module, to add an Individual Training bookmark the same way.
    /// </summary>
    public static class Entry
    {
        private static ManualLogSource L;
        private static float next;
        private static bool done;

        public static void Start(ManualLogSource log) { L = log; done = false; next = 0; L.LogInfo("dev bookmark list 0.5: open the bookmarks panel once"); }
        public static void Stop() { }

        public static void Tick()
        {
            if (done || Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 3f;
            var mods = Resources.FindObjectsOfTypeAll<GameWorldTabsAndBookmarksModule>();
            if (mods.Length == 0) return;
            done = true;
            var lines = new List<string>();
            try
            {
                var m = mods[0];
                foreach (var f in new[] { "m_fmBookmarkList", "m_fmcBookmarkList", "m_fmNationBookmarkList", "m_fmUnemployedBookmarkList" })
                {
                    var list = typeof(GameWorldTabsAndBookmarksModule).GetProperty(f)?.GetValue(m) as SI.Bindable.BookmarksList;
                    lines.Add($"##### {f}: {(list == null ? "none" : list.name)}");
                    if (list == null) continue;
                    var items = list.m_bookmarks;
                    for (int i = 0; i < items.Count; i++)
                    {
                        lines.Add($"--- {i}");
                        Describe(items[i], lines, "  ", 0);
                    }
                }
                lines.Add("##### m_possibleBookmarks");
                Describe(typeof(GameWorldTabsAndBookmarksModule).GetProperty("m_possibleBookmarks")?.GetValue(m), lines, "  ", 0);
            }
            catch (Exception e) { lines.Add("error: " + e); }
            var file = Path.Combine(Path.GetDirectoryName(typeof(Entry).Assembly.Location) ?? ".", "bookmarks.txt");
            File.WriteAllLines(file, lines);
            L.LogInfo($"dev bookmark list: {lines.Count} lines written to {file}");
        }

        private static void Describe(object o, List<string> lines, string pad, int depth)
        {
            if (o == null) { lines.Add(pad + "null"); return; }
            var t = o.GetType();
            if (depth > 3 || t.IsPrimitive || o is string) { lines.Add(pad + o); return; }
            foreach (var p in t.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                if (p.GetIndexParameters().Length > 0 || p.Name == "Pointer" || p.Name == "ObjectClass" || p.Name == "WasCollected" || p.Name.StartsWith("isWrapped") || p.Name == "pooledPtr") continue;
                object v;
                try { v = p.GetValue(o); } catch { continue; }
                string s;
                try { s = v?.ToString() ?? "null"; } catch { s = "?"; }
                if (v is UnityEngine.Object uo) s = $"{v.GetType().Name} '{(uo != null ? uo.name : "null")}'";
                lines.Add($"{pad}{p.Name} = {s}");
                if (v != null && !(v is string) && !v.GetType().IsPrimitive && !(v is UnityEngine.Object) && depth < 2 && (p.Name.Contains("Panel") || p.Name.Contains("Nav") || p.Name.Contains("Ref") || p.Name.Contains("Subtab") || p.Name.Contains("Asset") || p.Name.Contains("Data")))
                    Describe(v, lines, pad + "  ", depth + 1);
            }
        }
    }
}
