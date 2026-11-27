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
        private static bool searched, failed;

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

        private static void Add(BookmarksList list)
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
            if (!searched) { searched = true; guid = FindGuid(); Entry.Info($"bookmarks: Individual Training screen {(guid == null ? "not found in FM's catalogue" : "is " + guid)}"); }

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

        /// <summary>FM's catalogue key for its Individual Training screen id.</summary>
        private static string FindGuid()
        {
            var type = Il2CppType.Of<PanelID>();
            var locators = Addressables.ResourceLocators.GetEnumerator();
            var lm = locators.Cast<Il2CppSystem.Collections.IEnumerator>();
            while (lm.MoveNext())
            {
                var loc = locators.Current;
                if (loc == null) continue;
                var keys = loc.Keys.GetEnumerator();
                var km = keys.Cast<Il2CppSystem.Collections.IEnumerator>();
                while (km.MoveNext())
                {
                    var k = keys.Current;
                    var ks = k?.ToString();
                    if (ks == null || ks.Length != 32) continue;
                    Il2CppSystem.Collections.Generic.IList<UnityEngine.ResourceManagement.ResourceLocations.IResourceLocation> found;
                    if (!loc.Locate(k, type, out found) || found == null) continue;
                    var coll = found.Cast<Il2CppSystem.Collections.Generic.ICollection<UnityEngine.ResourceManagement.ResourceLocations.IResourceLocation>>();
                    if (coll.Count == 0) continue;
                    var first = found[0];
                    var id = first.InternalId ?? "";
                    var pk = first.PrimaryKey ?? "";
                    if (id.Contains(ScreenName) || pk.Contains(ScreenName)) return ks;
                }
            }
            return null;
        }
    }
}
