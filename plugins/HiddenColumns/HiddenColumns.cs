using System;
using System.Collections.Generic;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using HarmonyLib;
using SI.Bindable;

namespace ProjectFM.HiddenColumns
{
    /// <summary>
    /// ProjectFM Hidden Columns. FM already has a "Hidden" category in the column picker of its
    /// table views (CA, PA and the hidden attributes) but only offers it with the In-Game Editor.
    /// This lets the column picker offer that category; it only adds view columns, nothing can be
    /// edited. FM builds each picker once, so the category is unlocked just before it does.
    /// </summary>
    [BepInPlugin("projectfm.hiddencolumns", "ProjectFM Hidden Columns", "1.0.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;
        private static readonly HashSet<IntPtr> done = new();
        private static int unlocked;

        public override void Load()
        {
            L = Log;
            try
            {
                var h = new Harmony("projectfm.hiddencolumns");
                var t = typeof(StreamedTableViewSettingsCollection);
                h.Patch(AccessTools.Method(t, "BuildContextMenuData"),
                    prefix: new HarmonyMethod(typeof(Plugin).GetMethod(nameof(BeforeBuild))));
                h.Patch(AccessTools.Method(t, "PopulateContextMenuColumns"),
                    prefix: new HarmonyMethod(typeof(Plugin).GetMethod(nameof(BeforePopulate))));
                L.LogInfo("hidden columns: hooked FM's column picker");
            }
            catch (Exception e) { L.LogWarning("hidden columns: can't hook FM: " + e.Message); }
        }

        /// <summary>Takes the In-Game Editor check off the "hidden" category of this view list.</summary>
        private static bool Unlock(StreamedTableViewSettingsCollection c)
        {
            bool changed = false;
            var list = c.m_contextMenuData;
            if (list == null) return false;
            for (int i = 0; i < list.Count; i++)
            {
                var e = list[i];
                if (e == null || e.PropertyValue != "hidden" || e.Requirement == null) continue;
                e.Requirement = null;
                changed = true;
            }
            if (changed && ++unlocked <= 3) L.LogInfo($"hidden columns: category unlocked in '{c.name}'");
            if (unlocked == 4) L.LogInfo("hidden columns: (more lists unlocked, not logging each)");
            return changed;
        }

        public static void BeforeBuild(StreamedTableViewSettingsCollection __instance)
        {
            try { Unlock(__instance); done.Add(__instance.Pointer); }
            catch (Exception e) { L.LogWarning("hidden columns: " + e.Message); }
        }

        // If FM built a list before this plugin was ready, unlock it and have FM build it again.
        public static void BeforePopulate(StreamedTableViewSettingsCollection __instance)
        {
            try
            {
                if (!done.Add(__instance.Pointer)) return;
                if (Unlock(__instance)) __instance.BuildContextMenuData();
            }
            catch (Exception e) { L.LogWarning("hidden columns: " + e.Message); }
        }
    }
}
