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
        // FM's key for its Individual Training screen, found in game by 1.2 (which then crashed FM:
        // loading FM's screen ids to find it is not done any more)
        private static string guid = LoadKey() ?? "41012275212b88b46957d71fc17c5876";
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
            return;
            try
            {
                var k = __instance.m_panelReference.asset?.AssetGUID;
                if (!string.IsNullOrEmpty(k) && k.Length == 32 && seenKeys.Add(k)) toCheck.Enqueue(k);
            }
            catch { }
        }

        private static void CheckKeys()
        {
            return;
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

        private static bool named, described;

        /// <summary>
        /// The bookmark's name: FM's own title of its Individual Training screen (FM shows bookmark
        /// names from its text ids, so a plain text stays empty). The screen id is only read once
        /// FM has it in memory (after Individual Training has been open once), never loaded.
        /// </summary>
        private static float nextName;

        /// <summary>
        /// The bookmark's name: the text of the Individual Training entry in FM's Training menu
        /// (FM's screen title for it is empty). Read from FM's menu lists, never loaded.
        /// </summary>
        private static void Name()
        {
            if (named || made.Count == 0 || Time.realtimeSinceStartup < nextName) return;
            nextName = Time.realtimeSinceStartup + 3f;
            foreach (var l in Resources.FindObjectsOfTypeAll<PanelSubtabsList>())
            {
                if (l == null || l.WasCollected || l.m_submenus == null) continue;
                var info = FindSubtab(l.m_submenus, 0);
                if (info == null) continue;
                foreach (var b in made) if (b != null && !b.WasCollected) b.m_displayValue = info.m_displayValue;
                named = true;
                Entry.Info($"bookmarks: Individual Training bookmark named from FM's '{l.name}' menu (text id {info.m_displayValue.GameID}, menu uid {info.m_panelUID})");
                return;
            }
        }

        private static PanelSubtabInfo FindSubtab(Il2CppSystem.Collections.Generic.List<SIDropdownElement<PanelSubtabInfo>> list, int depth)
        {
            if (list == null || depth > 4) return null;
            for (int i = 0; i < list.Count; i++)
            {
                var e = list[i];
                if (e == null) continue;
                var info = e.PropertyValue;
                if (info != null && info.m_panelIDRef != null && info.m_panelIDRef.AssetGUID == guid) return info;
                var r = FindSubtab(e.ChildList, depth + 1);
                if (r != null) return r;
            }
            return null;
        }

        /// <summary>Logs how FM's own bookmarks for a tab inside a screen are set up (to fix the tab underline).</summary>
        private static void Describe(Il2CppSystem.Collections.Generic.List<BookmarkInfo> items)
        {
            if (described) return;
            described = true;
            foreach (var want in new[] { "TrainingBookmark", "PlayerShortlistBookmark", "FirstTeamBookmark", "NewsAroundTheWorldBookmark", Mark })
                for (int i = 0; i < items.Count; i++)
                {
                    var b = items[i];
                    if (b == null || b.name != want) continue;
                    var ev = b.m_openEvent;
                    string evs = "none";
                    if (ev != null)
                    {
                        var pr = ev.m_panelReference;
                        evs = $"panel {pr.asset?.AssetGUID} kind {pr.kind} binding '{pr.binding?.m_path}' anchor {ev.m_anchor} args {(ev.m_argumentBindings == null ? 0 : ev.m_argumentBindings.Count)} rebind {ev.m_rebindMethod} existing {ev.m_checkForExistingOpenedPanel}";
                    }
                    Entry.Info($"bookmarks: FM's '{want}': uid {b.m_panelUID}, panel {b.m_panelIDRef?.AssetGUID}, main {b.m_mainPanelIDRef?.AssetGUID}, text id {b.m_displayValue.GameID}, open: {evs}");
                }
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
            Name();
            if (failed || Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 3f;
            var mods = Resources.FindObjectsOfTypeAll<GameWorldTabsAndBookmarksModule>();
            try
            {
                // FM's live module (an early one it throws away can still be listed)
                foreach (var m in mods)
                {
                    if (m == null || m.WasCollected) continue;
                    foreach (var list in new[] { m.m_fmBookmarkList, m.m_fmcBookmarkList })
                        if (list != null && !list.WasCollected) Add(list);
                    break;
                }
            }
            catch (Exception e) { Entry.Log("bookmarks: Individual Training bookmark: " + e.Message); }
        }

        /// <summary>Harmony prefix on BookmarksList.Init: the bookmark is in FM's list before FM builds its views of it.</summary>
        public static void BeforeInit(BookmarksList __instance)
        {
            try { Add(__instance); } catch (Exception e) { Entry.Log("bookmarks: Individual Training bookmark: " + e.Message); }
        }

        /// <summary>Bookmarks.cfg: IndividualTrainingBookmark = 0 leaves FM's list alone.</summary>
        public static bool Enabled = true;

        internal static void Add(BookmarksList list)
        {
            if (!Enabled) return;
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
            try { Describe(items); } catch (Exception e) { Entry.Log("bookmarks: describe: " + e.Message); }
            Entry.Info($"bookmarks: Individual Training added to '{list.name}' ({items.Count} bookmarks)");
        }
    }
}
