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
        private static bool told, seen;
        private static int errors;

        public static void Tick()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.3f;
            try
            {
                if (module == null)
                {
                    // FM keeps an early copy it has thrown away: use the one whose values can be read
                    foreach (var mm in Resources.FindObjectsOfTypeAll<GameWorldTabsAndBookmarksModule>())
                    {
                        try { if (mm == null) continue; var _ = mm.CurrentPanel?.Value; var __ = mm.CurrentMainTab?.Value; module = mm; break; }
                        catch { }
                    }
                    if (module == null) return;
                }
                var m = module;
                Note(m);
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
                if (!seen) { seen = true; Entry.Info($"bookmarks: tab fix: Individual Training open (FM's current screen '{m.CurrentPanel?.Value?.name}', main tab '{m.CurrentMainTab?.Value?.name}', tab '{m.CurrentSecondaryTab?.Value?.name}'; Training id {(main == null ? "not found" : "found")})"); }
                if (main == null || cur == null) return;
                if (m.CurrentMainTab.Value?.name != Main) m.CurrentMainTab.Value = main;
                if (m.CurrentSecondaryTab.Value?.name != Sub) m.CurrentSecondaryTab.Value = cur;
                if (!told) { told = true; Entry.Info("bookmarks: Individual Training put under the Training tab (FM did not)"); }
            }
            catch (Exception e)
            {
                // FM replaced one of its objects: look them up again next time
                module = null; main = null; sub = null;
                if (++errors <= 5) Entry.Log("bookmarks: tab fix: " + e);
            }
        }

        /// <summary>FM's Individual Training panel is open and visible (searched a few levels down).</summary>
        private static bool OnScreen()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UnityEngine.UIElements.UIDocument>())
            {
                var root = doc.rootVisualElement;
                if (root != null && Visible(root, 0)) return true;
            }
            return false;
        }

        private static bool Visible(UnityEngine.UIElements.VisualElement e, int depth)
        {
            if (e.name == Sub) return e.ClassListContains("panel--visible");
            if (depth >= 4) return false;
            for (int i = 0; i < e.childCount; i++) if (Visible(e[i], depth + 1)) return true;
            return false;
        }

        private static string lastPanel;

        /// <summary>Logs FM's current screen when it changes (to see what FM has for Individual Training).</summary>
        private static void Note(GameWorldTabsAndBookmarksModule m)
        {
            var n = m.CurrentPanel?.Value?.name;
            if (n == lastPanel) return;
            lastPanel = n;
            if (noted++ < 15) Entry.Info($"bookmarks: FM's current screen '{n}', main tab '{m.CurrentMainTab?.Value?.name}', tab '{m.CurrentSecondaryTab?.Value?.name}'");
        }

        private static int noted;
    }
}
