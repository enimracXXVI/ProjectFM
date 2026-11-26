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

        public static void Start(ManualLogSource log) { L = log; next = 0; added = 0; first = true; L.LogInfo("dev faces 0.4: picture lined up just left of the shirt and its arrows"); }

        public static void Stop()
        {
            foreach (var root in Roots())
                foreach (var e in FindAll(root, Mark)) e.RemoveFromHierarchy();
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
            var rr = new StyleLength(Size / 2f);
            st.borderTopLeftRadius = st.borderTopRightRadius = st.borderBottomLeftRadius = st.borderBottomRightRadius = rr;
            st.overflow = new StyleEnum<Overflow>(Overflow.Hidden);
            st.backgroundColor = new StyleColor(new Color(0f, 0f, 0f, 0.25f));
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
        /// Just left of the leftmost thing beside the shirt (the out-of-possession arrow, or the
        /// shirt), level with the shirt. Only the picture moves, never the card's contents.
        /// </summary>
        private static void Place(VisualElement face, VisualElement row)
        {
            var inner = Child(row, "ShirtAndRoleMovements");
            if (inner == null) return;
            float left = float.MaxValue, top = float.MaxValue;
            for (int i = 0; i < inner.childCount; i++)
            {
                var c = inner[i];
                var b = c.worldBound;
                if (b.width <= 1f || b.height <= 1f) continue;
                try { if (c.resolvedStyle.display == DisplayStyle.None) continue; } catch { }
                left = Math.Min(left, b.xMin);
                string type = "";
                try { type = c.GetIl2CppType().Name; } catch { }
                if (type == "FMTacticsShirt") top = b.yMin;
            }
            if (left == float.MaxValue) return;
            var rb = row.worldBound;
            float x = left - rb.xMin - Size - 2f;
            float y = top == float.MaxValue ? 0f : top - rb.yMin;
            if (Math.Abs(face.resolvedStyle.left - x) > 1f) face.style.left = new StyleLength(x);
            if (Math.Abs(face.resolvedStyle.top - y) > 1f) face.style.top = new StyleLength(y);
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
