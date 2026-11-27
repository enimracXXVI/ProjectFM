using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using SI.Bindable;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.StaffNumbers
{
    [BepInPlugin("projectfm.staffnumbers", "ProjectFM Staff Numbers", "1.2.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            Settings.Load();
            ClassInjector.RegisterTypeInIl2Cpp<Runner>();
            AddComponent<Runner>();
            L.LogInfo($"staff numbers: loaded (word too = {Settings.WordToo})");
        }
    }

    /// <summary>StaffNumbers.cfg next to the plugin.</summary>
    internal static class Settings
    {
        public static bool WordToo, SwapTables;
        private static readonly string Path = System.IO.Path.Combine(
            System.IO.Path.GetDirectoryName(typeof(Settings).Assembly.Location) ?? Paths.PluginPath, "StaffNumbers.cfg");

        public static void Load()
        {
            try
            {
                if (!File.Exists(Path))
                {
                    File.WriteAllLines(Path, new[]
                    {
                        "# ProjectFM Staff Numbers. Restart FM after changing.",
                        "# WordToo: true shows FM's word after the number, e.g. 13 (Good)",
                        "WordToo = false",
                        "# SwapTables: true uses FM's plain number cells in staff tables (no colours)",
                        "SwapTables = false",
                    });
                    return;
                }
                foreach (var raw in File.ReadAllLines(Path))
                {
                    var line = raw.Trim();
                    if (line.StartsWith("#")) continue;
                    int eq = line.IndexOf('=');
                    if (eq < 0) continue;
                    var k = line.Substring(0, eq).Trim().ToLowerInvariant();
                    var v = line.Substring(eq + 1).Trim().ToLowerInvariant();
                    if (k == "wordtoo") WordToo = v == "true" || v == "1" || v == "yes";
                    if (k == "swaptables") SwapTables = v == "true" || v == "1" || v == "yes";
                }
            }
            catch (Exception e) { Plugin.L.LogWarning("staff numbers: settings: " + e.Message); }
        }
    }

    /// <summary>
    /// Staff tables: FM has two cells for each staff attribute column, one with the word
    /// (NonPlayerAttributeTableCell) and one with the number (NonPlayerAttributeNumberTableCell).
    /// Every table column using the word cell is switched to the number cell.
    /// </summary>
    internal static class Tables
    {
        private const string WordCell = "89a40734770aa7640acdd7c492c9ccc6";
        private const string NumberCell = "605555c0a3e29f249a813977edd10f8d";
        private static readonly HashSet<IntPtr> done = new();
        private static VisualTreeAsset numberAsset;
        private static int swapped;

        public static void Swap()
        {
            var all = Resources.FindObjectsOfTypeAll<TableTemplate>();
            int now = 0;
            foreach (var t in all)
            {
                if (t == null || done.Contains(t.Pointer)) continue;
                done.Add(t.Pointer);
                var rows = t.RowDataList;
                if (rows == null) continue;
                for (int i = 0; i < rows.Count; i++)
                {
                    var r = rows[i];
                    if (r?.m_uxmlRef == null || r.m_uxmlRef.AssetGUID != WordCell) continue;
                    var reference = new UnityEngine.AddressableAssets.AssetReferenceT<VisualTreeAsset>(NumberCell);
                    r.m_uxmlRef = reference;
                    if (r._Uxml_k__BackingField != null)
                    {
                        if (numberAsset == null)
                        {
                            numberAsset = SI.Core.VisualTreeAssetExtensions.LoadVisualTreeAsset(reference, out SI.Core.ResourceHandle<VisualTreeAsset> handle);
                        }
                        if (numberAsset != null) r._Uxml_k__BackingField = numberAsset;
                    }
                    now++;
                }
            }
            if (now > 0) { swapped += now; Plugin.L.LogInfo($"staff numbers: {now} table columns switched to numbers ({swapped} in all)"); }
        }
    }

    /// <summary>
    /// Staff attributes as numbers. On a staff profile FM shows each attribute as a word
    /// (Unsuited ... Outstanding) although the row holds the 1-20 value (attributebind.PropertyValue).
    /// This puts a text with that number in place of the word, with FM's own colour for it.
    /// </summary>
    public class Runner : MonoBehaviour
    {
        public Runner(IntPtr ptr) : base(ptr) { }
        private const string Mark = "pfm-staff-number";
        private const string WordClass = "data_display-coaching_ratings-small";
        private float next;
        private int errors;
        private bool told;

        private float nextTables;

        private void Update()
        {
            if (Time.realtimeSinceStartup >= nextTables)
            {
                nextTables = Time.realtimeSinceStartup + 3f;
                try { if (Settings.SwapTables) Tables.Swap(); }
                catch (Exception e) { if (++errors <= 3) Plugin.L.LogWarning("staff numbers: tables: " + e.Message); }
            }
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.25f;
            try
            {
                int n = 0;
                foreach (var doc in FindObjectsOfType<UIDocument>())
                {
                    var root = doc.rootVisualElement;
                    if (root == null) continue;
                    var found = new List<VisualElement>();
                    Find(root, found, 0);
                    foreach (var w in found) { Handle(w); n++; }
                }
                if (n > 0 && !told) { told = true; Plugin.L.LogInfo($"staff numbers: showing numbers ({n} attributes on screen)"); }
                errors = 0;
            }
            catch (Exception e) { if (++errors <= 3) Plugin.L.LogWarning("staff numbers: " + e.Message); }
        }

        private static void Find(VisualElement e, List<VisualElement> acc, int depth)
        {
            if (e.name == "attribute-value" && e.ClassListContains(WordClass)) { acc.Add(e); return; }
            if (IsTableWord(e)) { acc.Add(e); return; }
            if (depth > 90) return;
            for (int i = 0; i < e.childCount; i++) Find(e[i], acc, depth + 1);
        }

        private static List<string> Classes(VisualElement e)
        {
            var r = new List<string>();
            var list = e.GetClasses().TryCast<Il2CppSystem.Collections.Generic.List<string>>();
            if (list != null) for (int i = 0; i < list.Count; i++) r.Add(list[i]);
            return r;
        }

        /// <summary>
        /// FM's staff table cell with the word (NonPlayerAttributeTableCell): a text in a colour
        /// setter in "data_display-cell-standard-regular--unpacked", fed by "binding".
        /// </summary>
        private static bool IsTableWord(VisualElement e)
        {
            if (e.name != "text" || skip.Contains(e.Pointer)) return false;
            var setter = e.parent;
            if (setter == null || setter.TryCast<SIStyleSetter>() == null) return false;
            var cell = setter.parent;
            if (cell == null || cell.name != "data_display-cell-standard-regular--unpacked") return false;
            var expect = cell.parent;
            return expect != null && expect.ClassListContains("margin-right-global-gap-small") && expect.ClassListContains("align-items-start");
        }

        private static readonly HashSet<IntPtr> skip = new();
        private static readonly Dictionary<IntPtr, float> since = new();

        private static void Handle(VisualElement word)
        {
            var holder = word.parent;
            if (holder == null) return;
            bool table = word.name == "text";
            SIText num = null;
            for (int i = 0; i < holder.childCount; i++)
                if (holder[i].name == Mark) { num = holder[i].TryCast<SIText>(); break; }
            if (num == null)
            {
                num = new SIText { name = Mark };
                var m = new BindingMethod<SIText>();
                m.m_kind = BindingMethodKind.Direct;
                var d = new DirectBinding();
                d.Path = new BindingPath(table ? "binding" : "attributebind.PropertyValue");
                m.m_direct = d;
                num.TextBinding = m;
                num.pickingMode = PickingMode.Ignore;
                holder.Add(num);
                try { num.BindToData(); } catch { }
            }
            if (table)
            {
                // Only staff attribute cells hold a 1-20 number; anything else goes back to FM
                var t = num.TryCast<TextElement>()?.text;
                if (!int.TryParse(t, out var v) || v < 0 || v > 20)
                {
                    if (!since.TryGetValue(num.Pointer, out var at)) { since[num.Pointer] = Time.realtimeSinceStartup; word.style.display = DisplayStyle.Flex; return; }
                    if (Time.realtimeSinceStartup - at < 1.5f) { word.style.display = DisplayStyle.Flex; return; }
                    num.RemoveFromHierarchy();
                    word.style.display = DisplayStyle.Flex;
                    skip.Add(word.Pointer);
                    return;
                }
            }
            // Same look and colour as FM's word (FM changes the colour class as the row is reused)
            var want = Classes(word);
            var have = Classes(num);
            if (want.Count != have.Count || !want.TrueForAll(have.Contains))
            {
                num.ClearClassList();
                foreach (var c in want) num.AddToClassList(c);
            }
            if (Settings.WordToo)
            {
                // Number first, FM's word after it
                word.style.display = DisplayStyle.Flex;
                word.style.marginLeft = 4;
                num.SendToBack();
                word.BringToFront();
                holder.style.flexDirection = FlexDirection.Row;
            }
            else word.style.display = DisplayStyle.None;
        }
    }
}
