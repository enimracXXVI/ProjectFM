using System;
using System.Collections.Generic;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using SI.Bindable;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.StaffOverview
{
    /// <summary>
    /// Staff Overview: under each card (Coaching, Recruitment, Medical) adds FM's own staff
    /// contract table for that department and FM's team comparison block, fed by FM's own data,
    /// the way the MrTini23 skin does in its screen file, but at run time and without changing
    /// any game file.
    /// </summary>
    [BepInPlugin("projectfm.staffoverview", "ProjectFM Staff Overview", "0.1.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            ClassInjector.RegisterTypeInIl2Cpp<Adder>();
            AddComponent<Adder>();
            L.LogInfo("ProjectFM staff overview loaded.");
        }
    }

    public class Adder : MonoBehaviour
    {
        public Adder(IntPtr ptr) : base(ptr) { }

        private const string Mark = "pfm-staff";
        private float next;
        private int errors;
        private bool listedTemplates;
        private readonly Dictionary<string, VisualTreeAsset> templates = new Dictionary<string, VisualTreeAsset>();

        // FM's card name -> the department's comparison block and its data (from FM's own
        // Coaching / Recruitment / Medical Team tabs)
        private static readonly (string card, string block, string data)[] Cards =
        {
            ("ClubCoachingStaff", "ClubStaffCoachingTeamComparisonBlock", "team.StaffCoachingSubGroupComparisonAttributes"),
            ("ClubRecruitmentStaff", "ClubStaffRecruitmentTeamComparisonBlock", "team.StaffRecruitmentSubGroupComparisonAttributes"),
            ("ClubMedicalStaff", "ClubStaffMedicalTeamComparisonBlock", "team.StaffMedicalSubGroupComparisonAttributes"),
        };

        private void Update()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            try
            {
                Pass();
                errors = 0;
            }
            catch (Exception e)
            {
                if (++errors <= 5) Plugin.L.LogWarning("staff overview: " + e);
                if (errors >= 5) next = Time.realtimeSinceStartup + 10f;
            }
        }

        private VisualTreeAsset Template(string name)
        {
            if (templates.TryGetValue(name, out var t) && t != null) return t;
            foreach (var a in Resources.FindObjectsOfTypeAll<VisualTreeAsset>())
                if (a != null && a.name == name) { templates[name] = a; return a; }
            if (!listedTemplates)
            {
                listedTemplates = true;
                var found = new List<string>();
                foreach (var a in Resources.FindObjectsOfTypeAll<VisualTreeAsset>())
                    if (a != null && a.name.StartsWith("ClubStaff")) found.Add(a.name);
                Plugin.L.LogWarning($"staff overview: template {name} not loaded; ClubStaff templates in memory: {string.Join(", ", found)}");
            }
            return null;
        }

        private static VisualElement Find(VisualElement e, string name, int depth)
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

        private void Pass()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
            {
                var root = doc.rootVisualElement;
                if (root == null) continue;
                foreach (var c in Cards)
                {
                    var card = Find(root, c.card, 0);
                    if (card == null) continue;
                    var board = Find(card, "SIVisible_IsClub", 0);
                    var parent = board?.parent;
                    if (parent == null) continue;
                    bool done = false;
                    for (int i = 0; i < parent.childCount; i++)
                        if (parent[i].name == Mark) { done = true; break; }
                    if (done) continue;
                    Add(parent, parent.IndexOf(board) + 1, c.card, c.block, c.data);
                }
            }
        }

        private static BindingRemapper Remapper(params (string from, string to)[] maps)
        {
            var r = new BindingRemapper();
            var list = new Il2CppSystem.Collections.Generic.List<RemapInfo>();
            foreach (var (from, to) in maps)
            {
                var m = new RemapInfo();
                m.from = from;
                m.to = new BindingPath(to);
                list.Add(m);
            }
            r.Mappings = list;
            return r;
        }

        private void Add(VisualElement parent, int at, string card, string block, string data)
        {
            var table = Template("ClubStaffTeamContractBlock");
            var compare = Template(block);
            var box = new VisualElement { name = Mark };
            foreach (var cls in new[] { "align-self-stretch", "margin-top-global-gap-large", "flex-grow-class", "flex-basis-0" })
                box.AddToClassList(cls);
            parent.Insert(at, box);

            if (table != null)
            {
                // As FM's All Staff tab feeds it, narrowed to this card's department
                var r = Remapper(
                    ("personlist", "staffsubgroup.StaffSubGroupPersonListFiltered"),
                    ("filter", "team.StaffListFilter"),
                    ("isAllStaffTab", "const.False"),
                    ("showQuickFlicks", "const.False"),
                    ("showBlockAppearance", "const.False"));
                r.AddToClassList("align-self-stretch");
                r.AddToClassList("flex-grow-class");
                box.Add(r);
                var t = table.Instantiate();
                t.AddToClassList("align-self-stretch");
                t.AddToClassList("flex-grow-class");
                r.Add(t);
                try { r.BindToData(); } catch (Exception e) { Plugin.L.LogWarning($"staff overview: list binding ({card}): {e.Message}"); }
            }
            if (compare != null)
            {
                var r = Remapper(("attributes", data));
                r.AddToClassList("align-self-stretch");
                r.AddToClassList("margin-top-global-gap-large");
                box.Add(r);
                var t = compare.Instantiate();
                t.AddToClassList("align-self-stretch");
                r.Add(t);
                try { r.BindToData(); } catch (Exception e) { Plugin.L.LogWarning($"staff overview: comparison binding ({card}): {e.Message}"); }
            }
            Plugin.L.LogInfo($"staff overview: {card}: list {(table != null ? "added" : "missing")}, comparison {(compare != null ? "added" : "missing")}");
        }
    }
}
