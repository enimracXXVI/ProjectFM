using System;
using System.Collections.Generic;
using BepInEx.Logging;
using SI.Bindable;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.Dev
{
    /// <summary>
    /// Staff Overview test module (run by ProjectFM Dev Loader; F10 reloads it). Tries several
    /// ways of building a binding remapper in each Staff Overview card and logs which one passes
    /// FM's data through: each maps "x" to the card's board feedback text.
    /// </summary>
    public static class Entry
    {
        private static ManualLogSource L;
        private static float next, checkAt;
        private const string Mark = "pfm-dev";
        private static readonly string[] CardNames = { "ClubCoachingStaff", "ClubRecruitmentStaff", "ClubMedicalStaff" };
        private const string Target = "staffsubgroup.StaffSubGroupCountFeedbackString";

        public static void Start(ManualLogSource log) { L = log; next = 0; checkAt = 0; L.LogInfo("dev staff 0.7: mappings added through FM's own List.Add, then the real staff table and comparison"); }

        public static void Stop()
        {
            foreach (var root in Roots())
                foreach (var e in FindAll(root, Mark)) e.RemoveFromHierarchy();
        }

        public static void Tick()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            if (checkAt > 0 && Time.realtimeSinceStartup > checkAt) { checkAt = 0; Report(); }
            foreach (var root in Roots())
                foreach (var name in CardNames)
                {
                    var card = Find(root, name);
                    var board = card == null ? null : Find(card, "SIVisible_IsClub");
                    var parent = board?.parent;
                    if (parent == null || Find(parent, Mark) != null) continue;
                    var box = new VisualElement { name = Mark };
                    parent.Insert(parent.IndexOf(board) + 1, box);
                    foreach (var v in Variants) Try(box, v, name);
                    try { Real(box, name); } catch (Exception e) { L.LogWarning($"dev staff: {name} real: {e}"); }
                    checkAt = Time.realtimeSinceStartup + 2f;
                }
        }

        private static readonly string[] Variants = { "I" };

        private static RemapInfo Info(string from, string to, int serialised, bool create)
        {
            var m = new RemapInfo();
            m.from = from;
            m.to = create ? BindingPath.Create(to) : new BindingPath(to);
            if (serialised >= 0) m.m_serialisedType = (uint)serialised;
            try { m.OnAfterDeserialize(); } catch { }
            return m;
        }

        /// <summary>
        /// A mapping list filled through FM's own List.Add, called by reflection: the plugin
        /// interop's Add passes the boxed struct where FM expects the value, which left the
        /// mapping blank (0.6 read it back as empty with a garbage type).
        /// </summary>
        private static Il2CppSystem.Collections.Generic.List<RemapInfo> Maps(params (string from, string to)[] maps)
        {
            var list = new Il2CppSystem.Collections.Generic.List<RemapInfo>();
            var add = list.GetIl2CppType().GetMethod("Add");
            foreach (var (from, to) in maps)
            {
                var m = new RemapInfo();
                m.from = from;
                m.to = BindingPath.Create(to);
                var args = new Il2CppInterop.Runtime.InteropTypes.Arrays.Il2CppReferenceArray<Il2CppSystem.Object>(1);
                args[0] = m;
                add.Invoke(list, args);
            }
            return list;
        }

        private static Il2CppSystem.Collections.Generic.List<RemapInfo> List(RemapInfo m)
        {
            var l = new Il2CppSystem.Collections.Generic.List<RemapInfo>();
            l.Add(m);
            return l;
        }

        private static void Try(VisualElement box, string v, string card)
        {
            try
            {
                var holder = new VisualElement { name = "pfm-var-" + v };
                box.Add(holder);
                var r = new BindingRemapper();
                var probe = Probe("x");
                switch (v)
                {
                    case "A": // as 0.4: mappings, then into the screen, then bind the whole
                        r.Mappings = List(Info("x", Target, -1, true));
                        r.Add(probe); holder.Add(r);
                        BindableElementUtils.BindHierarchy(holder);
                        break;
                    case "B": // remapper bound first, then its children
                        r.Mappings = List(Info("x", Target, -1, true));
                        r.Add(probe); holder.Add(r);
                        r.BindToData();
                        BindableElementUtils.BindHierarchy(probe);
                        break;
                    case "C": // into the screen first, then mappings, then bind
                        holder.Add(r);
                        r.Mappings = List(Info("x", Target, -1, true));
                        r.BindToData();
                        r.Add(probe);
                        BindableElementUtils.BindHierarchy(probe);
                        break;
                    case "D": // through the remapper's core
                        holder.Add(r);
                        r.m_core.Mappings = List(Info("x", Target, -1, true));
                        r.m_core.BindToData();
                        r.Add(probe);
                        BindableElementUtils.BindHierarchy(probe);
                        break;
                    case "E": // serialised type 1
                        r.Mappings = List(Info("x", Target, 1, true));
                        r.Add(probe); holder.Add(r);
                        r.BindToData();
                        BindableElementUtils.BindHierarchy(probe);
                        break;
                    case "F": // plain BindingPath constructor
                        r.Mappings = List(Info("x", Target, -1, false));
                        r.Add(probe); holder.Add(r);
                        r.BindToData();
                        BindableElementUtils.BindHierarchy(probe);
                        break;
                    case "I": // mappings through FM's List.Add
                        r.Mappings = Maps(("x", Target));
                        r.Add(probe); holder.Add(r);
                        BindableElementUtils.BindHierarchy(holder);
                        Describe($"{card} remapper I", r);
                        break;
                    case "H": // a copy of a mapping from one of FM's own remappers, with our from/to
                    {
                        var fm = FmRemapper(box);
                        if (fm == null) { L.LogWarning("dev staff: no FM remapper found"); break; }
                        var src = fm.Mappings[0];
                        src.from = "x";
                        src.to = BindingPath.Create(Target);
                        r.Mappings = List(src);
                        r.Add(probe); holder.Add(r);
                        r.BindToData();
                        BindableElementUtils.BindHierarchy(probe);
                        break;
                    }
                    case "G": // bind everything twice: whole holder after the remapper
                        holder.Add(r);
                        r.Mappings = List(Info("x", Target, -1, true));
                        r.Add(probe);
                        r.BindToData();
                        BindableElementUtils.BindHierarchy(holder);
                        break;
                }
            }
            catch (Exception e) { L.LogWarning($"dev staff: {card} variant {v}: {e.Message}"); }
        }

        /// <summary>The nearest of FM's own remappers above the element, with mappings.</summary>
        private static BindingRemapper FmRemapper(VisualElement e)
        {
            for (var p = e.parent; p != null; p = p.parent)
            {
                var r = p.TryCast<BindingRemapper>();
                if (r != null && r.Mappings != null && r.Mappings.Count > 0) return r;
            }
            return null;
        }

        private static void Describe(string who, BindingRemapper r)
        {
            try
            {
                string key = "?", owner = "?";
                try { key = r.Key.ToString(); } catch (Exception e) { key = "err " + e.Message; }
                try { owner = r.m_core?.OwnerElement?.name ?? "(null)"; } catch (Exception e) { owner = "err " + e.Message; }
                var maps = r.Mappings;
                L.LogInfo($"dev staff: {who}: name '{r.name}', key {key}, core owner {owner}, mappings {maps?.Count ?? -1}, attached {r.panel != null}");
                if (maps != null)
                    for (int i = 0; i < maps.Count && i < 6; i++)
                    {
                        var m = maps[i];
                        string type = "?";
                        try { type = m.type.ToString(); } catch { }
                        L.LogInfo($"dev staff:    {m.from} -> {m.to.Path} | serialisedType {m.m_serialisedType} | type {type}");
                    }
            }
            catch (Exception e) { L.LogWarning($"dev staff: describe {who}: {e.Message}"); }
        }

        private const string TableGuid = "b00fa0597031b5642ba1e26ca3fb6ee0"; // ClubStaffTeamContractBlock
        private static readonly Dictionary<string, (string guid, string data)> Compare = new Dictionary<string, (string, string)>
        {
            ["ClubCoachingStaff"] = ("bb6a535ad4ad38446ac0e1b3552b4c85", "team.StaffCoachingSubGroupComparisonAttributes"),
            ["ClubRecruitmentStaff"] = ("1a3bc8c395c7a6f44983a8f52f4322de", "team.StaffRecruitmentSubGroupComparisonAttributes"),
            ["ClubMedicalStaff"] = ("9e54f89e398f44d41a54ed08d9c42a85", "team.StaffMedicalSubGroupComparisonAttributes"),
        };

        private static VisualElement Build(string guid)
        {
            var r = new UnityEngine.AddressableAssets.AssetReferenceT<VisualTreeAsset>(guid);
            return SI.Core.VisualTreeAssetExtensions.Instantiate(r);
        }

        /// <summary>FM's staff table and team comparison for the card, as the MrTini23 skin wires them.</summary>
        private static void Real(VisualElement box, string card)
        {
            var real = new VisualElement { name = "pfm-real" };
            real.AddToClassList("align-self-stretch");
            real.AddToClassList("flex-grow-class");
            box.Add(real);

            var tr = new BindingRemapper();
            tr.Mappings = Maps(
                ("personlist", "staffsubgroup.StaffSubGroupPersonListFiltered"),
                ("filter", "team.StaffListFilter"),
                ("isAllStaffTab", "const.False"),
                ("showQuickFlicks", "const.False"),
                ("showBlockAppearance", "const.False"));
            tr.AddToClassList("align-self-stretch");
            tr.AddToClassList("flex-grow-class");
            real.Add(tr);
            var table = Build(TableGuid);
            if (table != null)
            {
                table.AddToClassList("align-self-stretch");
                table.AddToClassList("flex-grow-class");
                tr.Add(table);
            }

            var (guid, data) = Compare[card];
            var cr = new BindingRemapper();
            cr.Mappings = Maps(("attributes", data));
            cr.AddToClassList("align-self-stretch");
            cr.AddToClassList("margin-top-global-gap-large");
            real.Add(cr);
            var cmp = Build(guid);
            if (cmp != null)
            {
                cmp.AddToClassList("align-self-stretch");
                cr.Add(cmp);
            }
            BindableElementUtils.BindHierarchy(real);
            L.LogInfo($"dev staff: {card} real: table {(table != null ? "built" : "missing")}, comparison {(cmp != null ? "built" : "missing")}");
        }

        private static SIText Probe(string path)
        {
            var t = new SIText { name = "pfm-probe" };
            var method = new BindingMethod<SIText>();
            method.m_kind = BindingMethodKind.Direct;
            var direct = new DirectBinding();
            direct.Path = BindingPath.Create(path);
            method.m_direct = direct;
            t.TextBinding = method;
            t.style.fontSize = new StyleLength(9f);
            t.style.opacity = new StyleFloat(0.5f);
            return t;
        }

        private static void Report()
        {
            foreach (var root in Roots())
                foreach (var name in CardNames)
                {
                    var card = Find(root, name);
                    var box = card == null ? null : Find(card, Mark);
                    if (box == null) continue;
                    var rb = Find(box, "pfm-real");
                    if (rb != null)
                        L.LogInfo($"dev staff: {name} real: table rows {Find(rb, "View")?.childCount ?? -1}, columns {Find(rb, "column-headers")?.childCount ?? -1}, comparison parts {Find(rb, "HasDataCheck")?.childCount ?? -1}");
                    // FM's own remappers on the way up from the card's insides, then ours
                    int n = 0;
                    for (var p = box.parent; p != null && n < 4; p = p.parent)
                    {
                        var fr = p.TryCast<BindingRemapper>();
                        if (fr != null) { Describe($"{name} FM remapper {n++}", fr); }
                    }
                    var ours = Find(box, "pfm-var-A");
                    var or = ours == null || ours.childCount == 0 ? null : ours[0].TryCast<BindingRemapper>();
                    if (or != null) Describe($"{name} our remapper A", or);
                    foreach (var v in Variants)
                    {
                        var holder = Find(box, "pfm-var-" + v);
                        var probe = holder == null ? null : Find(holder, "pfm-probe")?.TryCast<SIText>();
                        var text = probe?.text ?? "(none)";
                        L.LogInfo($"dev staff: {name} variant {v}: {(string.IsNullOrEmpty(text) ? "EMPTY" : "WORKS: " + text)}");
                    }
                }
        }

        private static IEnumerable<VisualElement> Roots()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
                if (doc.rootVisualElement != null) yield return doc.rootVisualElement;
        }

        private static VisualElement Find(VisualElement e, string name, int depth = 0)
        {
            if (e.name == name) return e;
            if (depth > 60) return null;
            for (int i = 0; i < e.childCount; i++)
            {
                var r = Find(e[i], name, depth + 1);
                if (r != null) return r;
            }
            return null;
        }

        private static List<VisualElement> FindAll(VisualElement e, string name, List<VisualElement> acc = null, int depth = 0)
        {
            acc ??= new List<VisualElement>();
            if (e.name == name) { acc.Add(e); return acc; }
            if (depth > 60) return acc;
            for (int i = 0; i < e.childCount; i++) FindAll(e[i], name, acc, depth + 1);
            return acc;
        }
    }
}
