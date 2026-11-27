using System;
using Il2CppInterop.Runtime;
using SI.Bindable;
using UnityEngine;
using UnityEngine.AddressableAssets;

namespace ProjectFM.Bookmarks
{
    /// <summary>
    /// Extra bookmarks FM does not offer: Individual Training. A copy of FM's own Training bookmark
    /// pointed at FM's Individual Training screen (TeamIndividualTrainingTool) is added to FM's list
    /// of bookmarks, so it shows under All Bookmarks and can be pinned like FM's own.
    /// </summary>
    internal static class Extra
    {
        private const string Mark = "PfmIndividualTrainingBookmark";
        private const string ScreenName = "TeamIndividualTrainingTool";
        private const uint ScreenUid = 83254784;
        private static float next;
        private static string guid;
        private static bool failed;

        public static void Tick()
        {
            if (failed || Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 3f;
            var mods = Resources.FindObjectsOfTypeAll<GameWorldTabsAndBookmarksModule>();
            if (mods.Length == 0) return;
            try
            {
                foreach (var list in new[] { mods[0].m_fmBookmarkList, mods[0].m_fmcBookmarkList })
                    if (list != null) Add(list);
            }
            catch (Exception e) { failed = true; Entry.Log("bookmarks: Individual Training bookmark: " + e); }
        }

        /// <summary>Harmony prefix on BookmarksList.Init: the bookmark is in FM's list before FM builds its views of it.</summary>
        public static void BeforeInit(BookmarksList __instance)
        {
            try { Add(__instance); } catch (Exception e) { Entry.Log("bookmarks: Individual Training bookmark: " + e.Message); }
        }

        internal static void Add(BookmarksList list)
        {
            var items = list.m_bookmarks;
            BookmarkInfo training = null;
            for (int i = 0; i < items.Count; i++)
            {
                if (items[i] == null) continue;
                if (items[i].name == Mark) return;
                if (items[i].name == "TrainingBookmark") training = items[i];
            }
            if (training == null) return;
            // Searching FM's catalogue for the screen's key crashed FM (1.1); the copy keeps the Training
            // screen's references and only takes the Individual Training screen's id

            var b = UnityEngine.Object.Instantiate(training);
            b.name = Mark;
            b.hideFlags = HideFlags.DontUnloadUnusedAsset;
            b.m_bookmarkText = "Individual Training";
            b.m_displayValue = new SI.Translation.TranslationID(0, "Individual Training");
            b.m_panelUID = ScreenUid;
            b.m_isDefaultSelection = 0;
            if (guid != null)
            {
                var r = new AssetReferenceT<PanelID>(guid);
                b.m_panelIDRef = r;
                var ev = b.m_openEvent;
                if (ev != null)
                {
                    var pr = ev.m_panelReference;
                    pr.asset = new AssetReferenceT<PanelID>(guid);
                    ev.m_panelReference = pr;
                }
            }
            items.Add(b);
            Entry.Info($"bookmarks: Individual Training added to '{list.name}' ({items.Count} bookmarks)");
        }
    }
}
