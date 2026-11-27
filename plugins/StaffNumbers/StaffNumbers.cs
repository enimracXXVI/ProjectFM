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
    [BepInPlugin("projectfm.staffnumbers", "ProjectFM Staff Numbers", "1.0.0")]
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
        public static bool WordToo;
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
                }
            }
            catch (Exception e) { Plugin.L.LogWarning("staff numbers: settings: " + e.Message); }
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

        private void Update()
        {
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

        private static void Handle(VisualElement word)
        {
            var holder = word.parent;
            if (holder == null) return;
            SIText num = null;
            for (int i = 0; i < holder.childCount; i++)
                if (holder[i].name == Mark) { num = holder[i].TryCast<SIText>(); break; }
            if (num == null)
            {
                num = new SIText { name = Mark };
                var m = new BindingMethod<SIText>();
                m.m_kind = BindingMethodKind.Direct;
                var d = new DirectBinding();
                d.Path = new BindingPath("attributebind.PropertyValue");
                m.m_direct = d;
                num.TextBinding = m;
                num.pickingMode = PickingMode.Ignore;
                holder.Add(num);
                try { num.BindToData(); } catch { }
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
