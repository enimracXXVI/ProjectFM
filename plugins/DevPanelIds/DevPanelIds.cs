using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using BepInEx.Logging;
using UnityEngine;

namespace ProjectFM.Dev
{
    /// <summary>
    /// Panel probe (run by ProjectFM Dev Loader). Every 5 seconds, when FM has loaded new screens,
    /// writes every loaded screen id (PanelID) with its details to panels.txt in the DevLoader
    /// folder, to point a new bookmark at the Individual Training screen.
    /// </summary>
    public static class Entry
    {
        private static ManualLogSource L;
        private static float next;
        private static int lastCount = -1;
        // Every screen seen this session: FM unloads screens, so the file keeps all of them
        private static readonly SortedDictionary<string, List<string>> seen = new();
        private static readonly string File_ = Path.Combine(BepInEx.Paths.PluginPath, "ProjectFM", "DevLoader", "panels.txt");

        public static void Start(ManualLogSource log) { L = log; next = 0; lastCount = -1; L.LogInfo("dev panels 0.6.1: open the Individual Training screen, wait 5 seconds"); }
        public static void Stop() { }

        public static void Tick()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 5f;
            var all = Resources.FindObjectsOfTypeAll<SI.Bindable.PanelID>();
            int before = seen.Count;
            foreach (var p in all)
            {
                if (p == null || seen.ContainsKey(p.name)) continue;
                var info = new List<string>();
                foreach (var prop in p.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                {
                    if (prop.GetIndexParameters().Length > 0) continue;
                    try { info.Add($"  {prop.Name} = {prop.GetValue(p)}"); } catch { }
                }
                seen[p.name] = info;
            }
            if (seen.Count == before) return;
            var lines = new List<string>();
            foreach (var kv in seen) { lines.Add($"## {kv.Key}"); lines.AddRange(kv.Value); }
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(File_));
                File.WriteAllLines(File_, lines);
                L.LogInfo($"dev panels: {seen.Count} screens written to {File_}");
            }
            catch (Exception e) { L.LogWarning("dev panels: " + e.Message); }
        }
    }
}
