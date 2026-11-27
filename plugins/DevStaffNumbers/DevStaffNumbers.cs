using System;
using System.Collections.Generic;
using BepInEx.Logging;
using SI.Bindable;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.Dev
{
    /// <summary>
    /// Staff numbers test (run by ProjectFM Dev Loader). On a staff profile's attribute list each
    /// row shows a word bound to attributebind.PropertyValue. This adds hidden texts bound to the
    /// row's other data (DisplayString, PropertyValue, AttributeType) and logs what each shows,
    /// to find where the plain number is.
    /// </summary>
    public static class Entry
    {
        private static ManualLogSource L;
        private static float next;
        private const string Mark = "pfm-test-";
        private static readonly string[] Paths = { "attributebind.DisplayString", "attributebind.PropertyValue", "attributebind.AttributeType", "attributebind.AttributeHighlightCategory" };
        private static readonly HashSet<string> logged = new();
        private static float logAt;

        public static void Start(ManualLogSource log) { L = log; next = 0; logged.Clear(); logAt = 0; L.LogInfo("dev staff numbers 0.3: open a staff profile's attributes"); }

        public static void Stop()
        {
            foreach (var root in Roots())
                foreach (var e in All(root))
                    if (e.name != null && e.name.StartsWith(Mark)) e.RemoveFromHierarchy();
        }

        public static void Tick()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            var rows = new List<VisualElement>();
            foreach (var root in Roots())
                foreach (var v in FindAll(root, "attribute-value")) rows.Add(v);
            bool addedNow = false;
            foreach (var v in rows)
            {
                var row = v.parent;
                if (row == null || HasChild(row, Mark + "0")) continue;
                for (int i = 0; i < Paths.Length; i++)
                {
                    var t = new SIText { name = Mark + i };
                    var m = new BindingMethod<SIText>();
                    m.m_kind = BindingMethodKind.Direct;
                    var d = new DirectBinding();
                    d.Path = new BindingPath(Paths[i]);
                    m.m_direct = d;
                    t.TextBinding = m;
                    t.style.display = DisplayStyle.None;
                    row.Add(t);
                    try { t.BindToData(); } catch (Exception e) { L.LogWarning($"dev staff numbers: bind {Paths[i]}: {e.Message}"); }
                }
                addedNow = true;
            }
            if (addedNow) logAt = Time.realtimeSinceStartup + 1f;
            if (logAt > 0 && Time.realtimeSinceStartup >= logAt)
            {
                logAt = 0;
                int n = 0;
                foreach (var v in rows)
                {
                    var row = v.parent;
                    var name = Text(FindUp(row, "attribute-name"));
                    var line = $"'{name}' shows '{Text(v)}'";
                    for (int i = 0; i < Paths.Length; i++) line += $" | {Paths[i].Substring(14)}='{Text(Child(row, Mark + i))}'";
                    if (logged.Add(line)) { L.LogInfo("dev staff numbers: " + line); n++; }
                }
                L.LogInfo($"dev staff numbers: {rows.Count} rows on screen, {n} new");
            }
        }

        private static string Text(VisualElement e)
        {
            var t = e?.TryCast<TextElement>();
            return t?.text ?? "-";
        }

        private static VisualElement FindUp(VisualElement e, string name)
        {
            for (var p = e; p != null; p = p.parent)
            {
                var f = FindAll(p, name);
                if (f.Count > 0) return f[0];
                if (p.name == "container") break;
            }
            return null;
        }

        private static bool HasChild(VisualElement e, string name) => Child(e, name) != null;

        private static VisualElement Child(VisualElement e, string name)
        {
            if (e == null) return null;
            for (int i = 0; i < e.childCount; i++) if (e[i].name == name) return e[i];
            return null;
        }

        private static IEnumerable<VisualElement> Roots()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
                if (doc.rootVisualElement != null) yield return doc.rootVisualElement;
        }

        private static IEnumerable<VisualElement> All(VisualElement e)
        {
            var acc = new List<VisualElement>();
            void Walk(VisualElement x, int d) { acc.Add(x); if (d > 80) return; for (int i = 0; i < x.childCount; i++) Walk(x[i], d + 1); }
            Walk(e, 0);
            return acc;
        }

        private static List<VisualElement> FindAll(VisualElement e, string name, List<VisualElement> acc = null, int depth = 0)
        {
            acc ??= new List<VisualElement>();
            if (e.name == name) { acc.Add(e); return acc; }
            if (depth > 80) return acc;
            for (int i = 0; i < e.childCount; i++) FindAll(e[i], name, acc, depth + 1);
            return acc;
        }
    }
}
