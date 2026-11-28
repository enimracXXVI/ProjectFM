using System;
using SI.Bindable;
using UnityEngine;

namespace ProjectFM.Bookmarks
{
    /// <summary>
    /// FM bug: opening Individual Training (from the Training menu or a bookmark) leaves the top
    /// bar on the previous tab (FM finds no main tab for TeamIndividualTrainingTool). While that
    /// screen is the current one, FM's own current main tab and current tab values, which its tab
    /// bar follows, are set to Training and Individual Training.
    /// </summary>
    internal static class NavFix
    {
        private const string Sub = "TeamIndividualTrainingTool", Main = "TrainingScreen";
        private static PanelID main, sub;
        private static GameWorldTabsAndBookmarksModule module;
        private static float next;
        private static bool told, failed;

        public static void Tick()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.3f;
            try
            {
                if (module == null || module.WasCollected)
                {
                    module = null;
                    var mods = Resources.FindObjectsOfTypeAll<GameWorldTabsAndBookmarksModule>();
                    if (mods.Length == 0) return;
                    foreach (var mm in mods) if (mm != null && !mm.WasCollected) { module = mm; break; }
                    if (module == null) return;
                }
                var m = module;
                // The open screen: FM's current panel, or Individual Training's panel on screen
                var cur = m.CurrentPanel?.Value;
                if (cur == null || cur.name != Sub)
                {
                    if (!OnScreen()) return;
                    cur = null;
                }
                if (main != null && main.WasCollected) main = null;
                if (sub != null && sub.WasCollected) sub = null;
                if (main == null || sub == null)
                    foreach (var p in Resources.FindObjectsOfTypeAll<PanelID>())
                    {
                        if (p == null) continue;
                        if (p.name == Main) main = p;
                        else if (p.name == Sub) sub = p;
                    }
                cur ??= sub;
                if (main == null || cur == null) return;
                if (m.CurrentMainTab.Value?.name != Main) m.CurrentMainTab.Value = main;
                if (m.CurrentSecondaryTab.Value?.name != Sub) m.CurrentSecondaryTab.Value = cur;
                if (!told) { told = true; Entry.Info("bookmarks: Individual Training put under the Training tab (FM did not)"); }
            }
            catch (Exception e)
            {
                // FM replaced one of its objects: look them up again next time
                module = null; main = null; sub = null;
                if (!failed) { failed = true; Entry.Log("bookmarks: tab fix: " + e.Message); }
            }
        }

        /// <summary>FM's Individual Training panel is open and visible.</summary>
        private static bool OnScreen()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UnityEngine.UIElements.UIDocument>())
            {
                var root = doc.rootVisualElement;
                if (root == null) continue;
                for (int i = 0; i < root.childCount; i++)
                {
                    var layer = root[i];
                    for (int j = 0; j < layer.childCount; j++)
                    {
                        var p = layer[j];
                        if (p.name == Sub && p.ClassListContains("panel--visible")) return true;
                    }
                }
            }
            return false;
        }
    }
}
