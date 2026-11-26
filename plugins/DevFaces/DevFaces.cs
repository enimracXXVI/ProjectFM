using System;
using System.Collections.Generic;
using BepInEx.Logging;
using SI.Bindable;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.Dev
{
    /// <summary>
    /// Pitch faces test module (run by ProjectFM Dev Loader; F10 reloads it). On the tactics
    /// pitch, puts FM's own player picture (PersonPicture) beside each player's shirt, fed with
    /// the player in that position, as the MrTini23 skin does in its TacticsPositionDetailed
    /// screen file (person -> position.Player), at run time without changing game files.
    /// </summary>
    public static class Entry
    {
        private static ManualLogSource L;
        private static float next;
        private const string Mark = "pfm-face";
        private const string PersonPictureGuid = "a3126e03e5bea6348ba86f23b5c5d7de";
        private static int added;
        private const float Size = 34f;
        private static bool first = true;

        public static void Start(ManualLogSource log) { L = log; next = 0; added = 0; first = true; measuredLogged = false; L.LogInfo("dev faces 0.9: no circle; picture and arrows kept inside the card"); }

        public static void Stop()
        {
            foreach (var root in Roots())
            {
                foreach (var e in FindAll(root, Mark)) e.RemoveFromHierarchy();
                // The arrows back where FM puts them
                foreach (var inner in FindAll(root, "ShirtAndRoleMovements"))
                    foreach (var name in new[] { "OOPRoleRemapper", "IPRoleRemapper" })
                    {
                        var arrow = Child(inner, name);
                        if (arrow == null) continue;
                        arrow.style.position = new StyleEnum<Position>(StyleKeyword.Null);
                        arrow.style.left = new StyleLength(StyleKeyword.Null);
                        arrow.style.top = new StyleLength(StyleKeyword.Null);
                        arrow.style.scale = new StyleScale(StyleKeyword.Null);
                        arrow.style.transformOrigin = new StyleTransformOrigin(StyleKeyword.Null);
                    }
            }
        }

        public static void Tick()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            int now = 0;
            foreach (var root in Roots())
                foreach (var row in FindAll(root, "ShirtAndIcons"))
                {
                    var face = Child(row, Mark);
                    if (face != null) { Place(face, row); continue; }
                    if (first) L.LogInfo("dev faces: adding the first picture");
                    try { Add(row); now++; }
                    catch (Exception e) { L.LogWarning("dev faces: " + e.Message); return; }
                }
            if (now > 0) { first = false; added += now; L.LogInfo($"dev faces: {now} pictures added ({added} in all)"); }
        }

        /// <summary>
        /// The picture sits outside the card, just left of its shirt row (absolutely placed), so
        /// nothing in the card moves: the shirt and both role arrows stay where FM puts them.
        /// </summary>
        private static VisualElement Add(VisualElement row)
        {
            var wrap = new VisualElement { name = Mark, pickingMode = PickingMode.Ignore };
            var st = wrap.style;
            // Fixed size and a plain pixel offset: 0.2 placed it by a percentage of the card
            // and resized it from the card's height, and FM froze
            st.position = new StyleEnum<Position>(Position.Absolute);
            st.left = new StyleLength(-(Size + 2f));
            st.top = new StyleLength(0f);
            st.width = st.height = st.minWidth = st.maxWidth = st.minHeight = st.maxHeight = new StyleLength(Size);


            row.Add(wrap);

            var remap = new BindingRemapper();
            remap.Mappings = Maps(("person", "position.Player"));
            remap.pickingMode = PickingMode.Ignore;
            Fill(remap);
            wrap.Add(remap);
            var pic = SI.Core.VisualTreeAssetExtensions.Instantiate(
                new UnityEngine.AddressableAssets.AssetReferenceT<VisualTreeAsset>(PersonPictureGuid));
            if (pic != null) { Fill(pic); pic.pickingMode = PickingMode.Ignore; remap.Add(pic); }
            BindableElementUtils.BindHierarchy(wrap);
            return wrap;
        }

        /// <summary>
        /// Lays out the card's top row: the role arrows in one column right of the shirt (out of
        /// possession on top, in possession under it), and the picture left of the shirt with its
        /// bottom on the shirt's bottom, so nothing runs under the roles bar. Only absolutely
        /// placed things move; the shirt stays where FM puts it.
        /// </summary>
        private static void Place(VisualElement face, VisualElement row)
        {
            var inner = Child(row, "ShirtAndRoleMovements");
            if (inner == null) return;
            VisualElement shirt = null;
            for (int i = 0; i < inner.childCount; i++)
            {
                string type = "";
                try { type = inner[i].GetIl2CppType().Name; } catch { }
                if (type == "FMTacticsShirt") { shirt = inner[i]; break; }
            }
            if (shirt == null) return;
            var sb = shirt.worldBound;
            if (sb.width <= 1f || sb.height <= 1f) return;
            var ib = inner.worldBound;

            // The role row (the coloured bar with the role names) under the shirt: the shirt
            // runs behind it, so its top is where everything above has to end
            var card = row.parent;
            float bottom = BarTop(card, row, sb);
            float room = bottom - sb.yMin; // visible height beside the shirt

            // Arrows: one column right of the shirt, the same size, the pair as tall as that room
            var arrows = new List<VisualElement>();
            float tallest = 0f;
            foreach (var name in new[] { "OOPRoleRemapper", "IPRoleRemapper" })
            {
                var arrow = Child(inner, name);
                if (arrow == null) continue;
                if (arrow.resolvedStyle.position != Position.Absolute)
                    arrow.style.position = new StyleEnum<Position>(Position.Absolute);
                float h = arrow.resolvedStyle.height;
                if (float.IsNaN(h) || h <= 1f || arrow.worldBound.width <= 1f) continue; // not shown in this view
                arrows.Add(arrow);
                tallest = Math.Max(tallest, h);
            }
            if (arrows.Count > 0 && room > 4f)
            {
                float f = Math.Min(1f, room / 2f / tallest); // same in every view: room for two
                float aw = 0f; foreach (var a in arrows) aw = Math.Max(aw, a.resolvedStyle.width * f);
                var rbox = row.worldBound;
                // Right of the shirt, but not past the card's right edge
                float ax = Math.Min(sb.xMax + 1f, rbox.xMax - aw);
                float x = ax - ib.xMin, y = sb.yMin - ib.yMin;
                foreach (var arrow in arrows)
                {
                    var sc = arrow.resolvedStyle.scale.value;
                    if (Math.Abs(sc.x - f) > 0.01f)
                    {
                        arrow.style.transformOrigin = new StyleTransformOrigin(new TransformOrigin(0f, 0f, 0f));
                        arrow.style.scale = new StyleScale(new Scale(new Vector2(f, f)));
                    }
                    Move(arrow, x, y);
                    y += tallest * f;
                }
            }

            // Picture: left of the shirt but inside the card (overlapping the shirt a little if
            // need be), its bottom on the role bar's top
            var rb = row.worldBound;
            Move(face, Math.Max(0f, sb.xMin - rb.xMin - Size - 2f), bottom - rb.yMin - Size);
        }

        private static bool measuredLogged;

        /// <summary>
        /// The top of the role bar: the highest visible thing drawn in the card after the shirt
        /// row (the bar overlaps the shirt, so the shirt's bottom is not it). The shirt's bottom
        /// when nothing is found.
        /// </summary>
        private static float BarTop(VisualElement card, VisualElement row, Rect shirt)
        {
            float top = float.MaxValue;
            string what = "nothing";
            if (card != null)
            {
                bool after = false;
                for (int i = 0; i < card.childCount; i++)
                {
                    var c = card[i];
                    if (c == row) { after = true; continue; }
                    if (!after) continue;
                    void Walk(VisualElement e, int depth)
                    {
                        if (depth > 8) return;
                        try { if (e.resolvedStyle.display == DisplayStyle.None) return; } catch { }
                        var b = e.worldBound;
                        // Something with a real box that starts below the shirt's top
                        if (b.width > 20f && b.height > 4f && b.yMin > shirt.yMin + 4f && b.yMin < top)
                        { top = b.yMin; what = (e.name ?? "") + " " + b; }
                        for (int k = 0; k < e.childCount; k++) Walk(e[k], depth + 1);
                    }
                    Walk(c, 0);
                }
            }
            if (!measuredLogged)
            {
                measuredLogged = true;
                L.LogInfo($"dev faces: first card: shirt {shirt}, row {row.worldBound}, card {card?.worldBound}, bar top {(top == float.MaxValue ? "not found" : top.ToString("0"))} from '{what}'");
            }
            return top == float.MaxValue ? shirt.yMax : top;
        }

        private static void Move(VisualElement e, float x, float y)
        {
            if (float.IsNaN(e.resolvedStyle.left) || Math.Abs(e.resolvedStyle.left - x) > 1f) e.style.left = new StyleLength(x);
            if (float.IsNaN(e.resolvedStyle.top) || Math.Abs(e.resolvedStyle.top - y) > 1f) e.style.top = new StyleLength(y);
        }

        private static void Fill(VisualElement e)
        {
            e.style.width = new StyleLength(new Length(100f, LengthUnit.Percent));
            e.style.height = new StyleLength(new Length(100f, LengthUnit.Percent));
        }

        /// <summary>Mappings added through FM's own List.Add (the interop's generic Add garbles them).</summary>
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

        private static VisualElement Child(VisualElement e, string name)
        {
            for (int i = 0; i < e.childCount; i++) if (e[i].name == name) return e[i];
            return null;
        }

        private static IEnumerable<VisualElement> Roots()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
                if (doc.rootVisualElement != null) yield return doc.rootVisualElement;
        }

        private static List<VisualElement> FindAll(VisualElement e, string name, List<VisualElement> acc = null, int depth = 0)
        {
            acc ??= new List<VisualElement>();
            if (e.name == name) { acc.Add(e); return acc; }
            if (depth > 70) return acc;
            for (int i = 0; i < e.childCount; i++) FindAll(e[i], name, acc, depth + 1);
            return acc;
        }
    }
}
