using System;
using System.Collections.Generic;
using System.IO;
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
        private static string guid = LoadKey();
        private static readonly string KeyFile = Path.Combine(Path.GetDirectoryName(typeof(Extra).Assembly.Location) ?? BepInEx.Paths.PluginPath, "IndividualTraining.key");
        private static readonly List<BookmarkInfo> made = new();
        private static readonly HashSet<string> seenKeys = new();
        private static readonly Queue<string> toCheck = new();

        private static string LoadKey()
        {
            try
            {
                var f = Path.Combine(Path.GetDirectoryName(typeof(Extra).Assembly.Location) ?? BepInEx.Paths.PluginPath, "IndividualTraining.key");
                if (File.Exists(f)) { var k = File.ReadAllText(f).Trim(); if (k.Length == 32) return k; }
            }
            catch { }
            return null;
        }

        /// <summary>
        /// Harmony postfix on OpenPanelEventContext.FillEvent: every screen FM opens passes its key
        /// here. Keys are checked one by one (loading FM's screen id for the key, already in memory)
        /// until the Individual Training screen's is found; it is then kept in IndividualTraining.key.
        /// </summary>
        public static void AfterFill(SI.Bindable.Events.OpenPanelEventContext __instance)
        {
            if (guid != null) return;
            try
            {
                var k = __instance.m_panelReference.asset?.AssetGUID;
                if (!string.IsNullOrEmpty(k) && k.Length == 32 && seenKeys.Add(k)) toCheck.Enqueue(k);
            }
            catch { }
        }

        private static void CheckKeys()
        {
            if (guid != null || toCheck.Count == 0) return;
            var k = toCheck.Dequeue();
            try
            {
                var h = Addressables.LoadAssetAsync<PanelID>(new Il2CppSystem.Object(IL2CPP.ManagedStringToIl2Cpp(k)));
                var id = h.WaitForCompletion();
                if (id != null && id.name == ScreenName)
                {
                    guid = k;
                    try { File.WriteAllText(KeyFile, k); } catch { }
                    Entry.Info($"bookmarks: found FM's Individual Training screen ({k}); the bookmark opens it now");
                    foreach (var b in made) Point(b);
                }
            }
            catch (Exception e) { Entry.Log("bookmarks: screen key: " + e.Message); }
        }

        private static void Point(BookmarkInfo b)
        {
            if (guid == null || b == null) return;
            b.m_panelIDRef = new AssetReferenceT<PanelID>(guid);
            var ev = b.m_openEvent;
            if (ev == null) return;
            var pr = ev.m_panelReference;
            pr.asset = new AssetReferenceT<PanelID>(guid);
            ev.m_panelReference = pr;
        }
        private static bool failed;

        public static void Tick()
        {
            CheckKeys();
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
            // No FM text id for it: -1 with the text itself (0 showed nothing)
            b.m_displayValue = new SI.Translation.TranslationID(-1, "Individual Training");
            b.m_panelUID = ScreenUid;
            b.m_isDefaultSelection = 0;
            Point(b);
            made.Add(b);
            items.Add(b);
            Entry.Info($"bookmarks: Individual Training added to '{list.name}' ({items.Count} bookmarks)");
        }
    }
}
