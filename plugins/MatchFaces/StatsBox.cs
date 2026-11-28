using System;
using System.Collections.Generic;
using SI.Bindable;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.MatchFaces
{
    /// <summary>
    /// When FM's player menu opens over the match squad bar, a box with that player's live match
    /// stats is shown beside the menu. The box lives inside the clicked player's block (so it is
    /// fed by FM's match player "playerinfo" and its stats "playerinfo.Stats") and is placed next
    /// to the menu; the bar's containers are told not to clip it.
    /// </summary>
    internal static class StatsBox
    {
        private const string Mark = "pfm-match-stats";
        private static VisualElement shownIn;

        private static readonly (string title, (string label, string path, string path2)[] rows)[] Sections =
        {
            ("Passing", new[]
            {
                ("Passes", "playerinfo.Stats.PassCompleted", "playerinfo.Stats.PassAttempts"),
                ("Pass %", "playerinfo.Stats.PassCompletionPercentage", (string)null),
                ("Key passes", "playerinfo.Stats.KeyPasses", (string)null),
                ("Progressive", "playerinfo.Stats.ProgressivePasses", (string)null),
            }),
            ("Creation", new[]
            {
                ("Chances", "playerinfo.Stats.ChancesCreated", (string)null),
                ("Clear-cut", "playerinfo.Stats.ClearCutChances", (string)null),
                ("xA", "playerinfo.Stats.ExpectedAssists", (string)null),
                ("Dribbles", "playerinfo.Stats.DribblesMade", (string)null),
            }),
            ("Defending", new[]
            {
                ("Tackles", "playerinfo.Stats.TackleCompleted", "playerinfo.Stats.TackleAttempts"),
                ("Interceptions", "playerinfo.Stats.Interceptions", (string)null),
                ("Headers", "playerinfo.Stats.HeaderCompleted", "playerinfo.Stats.HeaderAttempts"),
                ("Poss. won / lost", "playerinfo.Stats.PossessionWon", "playerinfo.Stats.PossessionLost"),
            }),
            ("Shooting", new[]
            {
                ("Goals", "playerinfo.Goals", (string)null),
                ("Shots / on target", "playerinfo.Stats.ShotAttempts", "playerinfo.Stats.ShotsOnTarget"),
                ("xG", "playerinfo.Stats.ExpectedGoals", (string)null),
                ("Assists", "playerinfo.Assists", (string)null),
            }),
            ("Physical", new[]
            {
                ("Distance (km)", "playerinfo.Stats.DistanceRan", (string)null),
                ("Sprints", "playerinfo.Stats.Sprints", (string)null),
                ("Fouls made", "playerinfo.Stats.FoulsMade", (string)null),
                ("Fouls won", "playerinfo.Stats.FoulsAgainst", (string)null),
            }),
        };

        public static void Tick()
        {
            var menu = OpenPlayerMenu();
            if (menu == null) { Hide(); return; }
            var block = ClickedBlock(menu);
            if (block == null) { Hide(); return; }
            if (shownIn != block) { Hide(); shownIn = block; }
            var box = Child(block, Mark) ?? Build(block);
            box.style.display = DisplayStyle.Flex;
            Place(box, block, menu);
        }

        private static void Hide()
        {
            if (shownIn != null)
            {
                var b = Child(shownIn, Mark);
                if (b != null) b.style.display = DisplayStyle.None;
            }
            shownIn = null;
        }

        /// <summary>FM's floating player menu (it starts with the player's picture row).</summary>
        private static VisualElement OpenPlayerMenu()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
            {
                var root = doc.rootVisualElement;
                if (root == null) continue;
                foreach (var f in Find(root, "floating-element-root"))
                {
                    if (f.resolvedStyle.display == DisplayStyle.None || f.childCount == 0) continue;
                    var icon = Find(f, "PlayerIcon");
                    if (icon.Count == 0) continue;
                    // The menu's visible frame
                    var frame = f[0];
                    if (frame.worldBound.width > 10) return frame;
                }
            }
            return null;
        }

        /// <summary>The squad bar block under the menu: the one the menu was opened from (closest below it).</summary>
        private static VisualElement ClickedBlock(VisualElement menu)
        {
            var m = menu.worldBound;
            VisualElement best = null;
            float bestD = float.MaxValue;
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
            {
                var root = doc.rootVisualElement;
                if (root == null) continue;
                foreach (var b in Find(root, "BindingRoot_SquadOverviewPlayerBlock"))
                {
                    var r = b.worldBound;
                    if (r.width < 5) continue;
                    // FM opens the menu just above the clicked block, lined up with it
                    float dx = Mathf.Abs(r.center.x - m.center.x);
                    float dy = Mathf.Abs(r.yMin - m.yMax);
                    float d = dx + dy * 2f;
                    if (d < bestD) { bestD = d; best = b; }
                }
            }
            return best;
        }

        private static VisualElement Build(VisualElement block)
        {
            var box = new VisualElement { name = Mark, pickingMode = PickingMode.Ignore };
            var st = box.style;
            st.position = Position.Absolute;
            st.width = 300;
            st.backgroundColor = new Color(0.13f, 0.14f, 0.17f, 0.97f);
            st.borderTopLeftRadius = 6; st.borderTopRightRadius = 6; st.borderBottomLeftRadius = 6; st.borderBottomRightRadius = 6;
            st.paddingLeft = 10; st.paddingRight = 10; st.paddingTop = 8; st.paddingBottom = 8;
            var b = new StyleColor(new Color(1, 1, 1, 0.12f));
            st.borderTopColor = b; st.borderBottomColor = b; st.borderLeftColor = b; st.borderRightColor = b;
            st.borderTopWidth = 1; st.borderBottomWidth = 1; st.borderLeftWidth = 1; st.borderRightWidth = 1;

            var head = Row();
            head.Add(Text("playerinfo.person.Name", "heading-sm", true));
            var right = Row();
            right.Add(Label("Rating ", 12));
            right.Add(Text("playerinfo.MatchRating", "body-md-strong", false));
            right.Add(Label("   Con ", 12));
            right.Add(Text("playerinfo.Condition", "body-md-strong", false));
            head.Add(right);
            head.style.justifyContent = Justify.SpaceBetween;
            head.style.marginBottom = 6;
            box.Add(head);

            foreach (var (title, rows) in Sections)
            {
                var t = Label(title, 12);
                t.style.unityFontStyleAndWeight = FontStyle.Bold;
                t.style.color = new Color(0.75f, 0.78f, 0.85f);
                t.style.marginTop = 4;
                box.Add(t);
                foreach (var (label, path, path2) in rows)
                {
                    var r = Row();
                    r.style.justifyContent = Justify.SpaceBetween;
                    r.Add(Label(label, 12));
                    var v = Row();
                    v.Add(Text(path, "body-sm", false));
                    if (path2 != null) { v.Add(Label(" / ", 12)); v.Add(Text(path2, "body-sm", false)); }
                    r.Add(v);
                    box.Add(r);
                }
            }
            block.Add(box);
            // FM's bar clips what sticks out of it: let the box show above it
            for (var p = block; p != null && p.name != "MainUIDocument-container"; p = p.parent)
                p.style.overflow = Overflow.Visible;
            BindableElementUtils.BindHierarchy(box);
            return box;
        }

        /// <summary>Beside FM's menu (to its right), bottoms lined up.</summary>
        private static void Place(VisualElement box, VisualElement block, VisualElement menu)
        {
            var m = menu.worldBound;
            var origin = block.worldBound;
            float h = box.resolvedStyle.height > 1 ? box.resolvedStyle.height : 420f;
            box.style.left = m.xMax - origin.xMin + 8f;
            box.style.top = m.yMax - origin.yMin - h;
        }

        private static VisualElement Row()
        {
            var r = new VisualElement { pickingMode = PickingMode.Ignore };
            r.style.flexDirection = FlexDirection.Row;
            r.style.alignItems = Align.Center;
            return r;
        }

        private static Label Label(string text, float size)
        {
            var l = new Label(text) { pickingMode = PickingMode.Ignore };
            l.style.fontSize = size;
            l.style.color = new Color(0.82f, 0.84f, 0.88f);
            l.style.marginLeft = 0; l.style.marginRight = 0; l.style.paddingLeft = 0; l.style.paddingRight = 0;
            return l;
        }

        private static SIText Text(string path, string cls, bool bold)
        {
            var t = new SIText { pickingMode = PickingMode.Ignore };
            var m = new BindingMethod<SIText>();
            m.m_kind = BindingMethodKind.Direct;
            var d = new DirectBinding();
            d.Path = new BindingPath(path);
            m.m_direct = d;
            t.TextBinding = m;
            t.AddToClassList(cls);
            t.style.color = Color.white;
            if (bold) t.style.unityFontStyleAndWeight = FontStyle.Bold;
            return t;
        }

        private static VisualElement Child(VisualElement e, string name)
        {
            for (int i = 0; i < e.childCount; i++) if (e[i].name == name) return e[i];
            return null;
        }

        private static List<VisualElement> Find(VisualElement e, string name, List<VisualElement> acc = null, int depth = 0)
        {
            acc ??= new List<VisualElement>();
            if (e.name == name) { acc.Add(e); return acc; }
            if (depth > 60) return acc;
            for (int i = 0; i < e.childCount; i++) Find(e[i], name, acc, depth + 1);
            return acc;
        }
    }
}
