using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using BepInEx.Logging;

namespace ProjectFM.Dev
{
    /// <summary>
    /// Property list probe (run by ProjectFM Dev Loader). Writes every data property FM's screens
    /// can bind to (per kind of object: person, player, staff attribute...) with its type into
    /// fm-properties.txt next to the module, so new plugins can be fed with FM's own data.
    /// </summary>
    public static class Entry
    {
        private static ManualLogSource L;
        private static bool done;

        public static void Start(ManualLogSource log) { L = log; done = false; L.LogInfo("dev probe 0.2: writing FM's property list with names"); }
        public static void Stop() { }

        public static void Tick()
        {
            if (done) return;
            done = true;
            try { Write(); }
            catch (Exception e) { L.LogWarning("dev probe: " + e); }
        }

        private static void Write()
        {
            var folder = Path.GetDirectoryName(typeof(Entry).Assembly.Location);
            if (string.IsNullOrEmpty(folder)) folder = Path.Combine(BepInEx.Paths.PluginPath, "ProjectFM", "DevLoader");
            var file = Path.Combine(folder, "fm-properties.txt");
            var lines = new List<string>();
            int types = 0, props = 0, errors = 0;
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                var n = asm.GetName().Name ?? "";
                if (!(n.StartsWith("FM.") || n.StartsWith("SI."))) continue;
                Type[] all;
                try { all = asm.GetTypes(); } catch (ReflectionTypeLoadException e) { all = e.Types.Where(t => t != null).ToArray(); }
                foreach (var t in all.OrderBy(t => t.FullName))
                {
                    var get = t.GetMethod("GetPropertiesInternal", BindingFlags.Public | BindingFlags.Static);
                    var desc = t.GetMethod("GetPropertyDescriptionInternal", BindingFlags.Public | BindingFlags.Static);
                    var kind = t.GetMethod("GetPropertyTypeInternal", BindingFlags.Public | BindingFlags.Static);
                    if (get == null || get.GetParameters().Length != 1) continue;
                    try
                    {
                        var list = Activator.CreateInstance(get.GetParameters()[0].ParameterType);
                        get.Invoke(null, new[] { list });
                        int count = (int)list.GetType().GetProperty("Count").GetValue(list);
                        var item = list.GetType().GetProperty("Item");
                        lines.Add($"## {t.FullName} ({count})");
                        types++;
                        for (int i = 0; i < count; i++)
                        {
                            var p = item.GetValue(list, new object[] { i });
                            uint id = (uint)p.GetType().GetProperty("ID").GetValue(p);
                            string nm = Name(p);
                            string d = "", k = "";
                            try { d = desc?.Invoke(null, new object[] { id }) as string ?? ""; } catch { }
                            try
                            {
                                var b = kind?.Invoke(null, new object[] { id });
                                if (b != null)
                                {
                                    var bt = b.GetType();
                                    k = $"{bt.GetProperty("Kind")?.GetValue(b)} {bt.GetProperty("Type")?.GetValue(b)} ref={bt.GetProperty("Reference")?.GetValue(b)}{((bool?)bt.GetProperty("IsList")?.GetValue(b) == true ? " list" : "")}";
                                }
                            }
                            catch { }
                            lines.Add($"  {nm} | {id} {Tag(id)} | {d} | {k}");
                            props++;
                        }
                    }
                    catch (Exception e) { if (++errors <= 5) L.LogWarning($"dev probe: {t.FullName}: {e.InnerException?.Message ?? e.Message}"); }
                }
            }
            File.WriteAllLines(file, lines);
            L.LogInfo($"dev probe: {props} properties of {types} kinds written to {file}");
        }

        private static MethodInfo getName;
        private static string Name(object p)
        {
            try
            {
                if (getName == null)
                    getName = typeof(SI.Bindable.Reference.Core.IdentifierUtils).GetMethod("GetName").MakeGenericMethod(p.GetType());
                var n = getName.Invoke(null, new[] { p }) as string;
                if (!string.IsNullOrEmpty(n)) return n;
            }
            catch { }
            try { return p.ToString(); } catch { return "?"; }
        }

        // FM's ids are often four letters packed into a number (e.g. PCAB)
        private static string Tag(uint id)
        {
            var c = new[] { (char)(id >> 24), (char)((id >> 16) & 255), (char)((id >> 8) & 255), (char)(id & 255) };
            return c.All(ch => ch >= 32 && ch < 127) ? new string(c) : "";
        }
    }
}
