using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using Il2CppInterop.Runtime.InteropTypes.Arrays;
using SI.Bindable;
using UnityEngine;

namespace ProjectFM.MatchColumns
{
    [BepInPlugin("projectfm.matchcolumns", "ProjectFM Match Columns", "1.0.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            Settings.Load();
            ClassInjector.RegisterTypeInIl2Cpp<Runner>();
            AddComponent<Runner>();
            L.LogInfo($"match columns: team talk {Settings.Names(Settings.TeamTalk)}; match stats view {Settings.Names(Settings.StatsView)}");
        }
    }

    /// <summary>MatchColumns.cfg next to the plugin.</summary>
    internal static class Settings
    {
        public static readonly List<(string id, float width)> TeamTalk = new(), StatsView = new();
        public static readonly string Folder = System.IO.Path.GetDirectoryName(typeof(Settings).Assembly.Location) ?? Paths.PluginPath;
        private static readonly string Path = System.IO.Path.Combine(Folder, "MatchColumns.cfg");

        public static string Names(List<(string id, float width)> l) => l.Count == 0 ? "off" : string.Join(", ", l.ConvertAll(c => c.id));

        public static void Load()
        {
            try
            {
                if (!File.Exists(Path))
                    File.WriteAllLines(Path, new[]
                    {
                        "# ProjectFM Match Columns: FM squad-table columns in match screens. Restart FM after changing.",
                        "# List columns in order, separated by commas; add :width to set a width, e.g. morale:140.",
                        "# Every column name you can use is in MatchColumns-list.txt (written once FM's squad table loads).",
                        "# Leave a line empty to turn that part off.",
                        "",
                        "# Team talk table (pre-match, half time, full time): added after Match Sharpness",
                        "TeamTalk = morale:140, fatigue-icon:50",
                        "",
                        "# New 'Fitness and Injuries' view in the match stats table (the one with Key Statistics, Passing...)",
                        "StatsView = condition-icon:50, match-sharpness:50, morale:140, fatigue-icon:50",
                    });
                foreach (var raw in File.ReadAllLines(Path))
                {
                    var line = raw.Trim();
                    if (line.StartsWith("#")) continue;
                    int eq = line.IndexOf('=');
                    if (eq < 0) continue;
                    var key = line.Substring(0, eq).Trim().ToLowerInvariant();
                    var list = key == "teamtalk" ? TeamTalk : key == "statsview" ? StatsView : null;
                    if (list == null) continue;
                    foreach (var part in line.Substring(eq + 1).Split(','))
                    {
                        var p = part.Trim();
                        if (p.Length == 0) continue;
                        float w = 0;
                        int c = p.IndexOf(':');
                        if (c > 0)
                        {
                            float.TryParse(p.Substring(c + 1).Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out w);
                            p = p.Substring(0, c).Trim();
                        }
                        list.Add((p.ToLowerInvariant(), w));
                    }
                }
            }
            catch (Exception e) { Plugin.L.LogWarning("match columns: settings: " + e.Message); }
        }
    }

    /// <summary>
    /// FM squad-table columns (morale, fatigue, condition...) in match screens. FM's match tables
    /// only know their own columns and FM unloads its squad table during matches, so the wanted
    /// squad columns are copied whenever the squad table is loaded. They are then added, fed by
    /// each row's player, to the team talk table and to a new view of the match stats table.
    /// </summary>
    public class Runner : MonoBehaviour
    {
        public Runner(IntPtr ptr) : base(ptr) { }
        private const string Prefix = "pfm-";
        private const int ViewNameId = 13702; // FM's "Fitness and Injuries"
        private static readonly string[] TalkViews = { "TeamTalksTablePreMatch", "TeamTalksTableHalfTime", "TeamTalksTableFullTime" };
        private const string StatsFactory = "PlayerStatsExtendedFactory", StatsCollection = "PlayerAdaptiveFormationStatsTableViewCollection", StatsTemplateView = "PlayerAdaptiveFormationStatsSetPiecesTable";

        private readonly Dictionary<string, TableTemplate.RowData> kept = new();
        private readonly HashSet<string> missing = new();
        private readonly HashSet<IntPtr> done = new();
        private bool listed, toldWaiting, statsReady;
        private float next;
        private int errors;

        private void Update()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 2f;
            try { Patch(); errors = 0; }
            catch (Exception e) { if (++errors <= 3) Plugin.L.LogWarning("match columns: " + e); }
        }

        private void Patch()
        {
            TableTemplate players = null, talk = null, stats = null;
            foreach (var t in Resources.FindObjectsOfTypeAll<TableTemplate>())
            {
                if (t == null) continue;
                switch (t.name)
                {
                    case "PlayerTableFactory": players = t; break;
                    case "TeamTalkPlayerReactionTableFactory": talk = t; break;
                    case StatsFactory: stats = t; break;
                }
            }
            if (players != null) Keep(players);
            if (kept.Count == 0)
            {
                if ((talk != null || stats != null) && !toldWaiting) { toldWaiting = true; Plugin.L.LogInfo("match columns: FM's squad table is not loaded yet; open your squad screen once before the match"); }
                return;
            }
            // Team talk: row.Player is the match player, .Person the player; the squad table's "team" is row.Team
            if (talk != null && Settings.TeamTalk.Count > 0 && done.Add(talk.Pointer))
                Plugin.L.LogInfo($"match columns: {AddRows(talk, Settings.TeamTalk, "binding.Player.Person", "binding.Team")} columns added to FM's team talk table");
            // Match stats: row.Player is the player; the team is the report's team
            if (stats != null && Settings.StatsView.Count > 0 && done.Add(stats.Pointer))
            {
                statsReady = true;
                Plugin.L.LogInfo($"match columns: {AddRows(stats, Settings.StatsView, "binding.Player", "reportcontextteam")} columns added to FM's match stats table");
            }
            Views();
        }

        private void Views()
        {
            foreach (var s in Resources.FindObjectsOfTypeAll<StreamedTableViewSettings>())
            {
                if (s == null || Array.IndexOf(TalkViews, s.name) < 0 || !done.Add(s.Pointer)) continue;
                var list = s.m_tableView?.m_tableConfig;
                if (list == null) continue;
                int at = list.Count;
                for (int i = 0; i < list.Count; i++) if (list[i].m_columnID == "sharpness") at = i + 1;
                var template = list[Math.Max(0, at - 1)];
                int n = 0;
                foreach (var (id, width) in Settings.TeamTalk)
                {
                    if (!kept.ContainsKey(id) || Has(list, Prefix + id)) continue;
                    list.Insert(at++, Column(template, Prefix + id, width, kept[id].m_defaultWidth));
                    n++;
                }
                Plugin.L.LogInfo($"match columns: {n} columns added to the view '{s.name}'");
            }
            if (Settings.StatsView.Count == 0 || !statsReady) return;
            foreach (var c in Resources.FindObjectsOfTypeAll<StreamedTableViewSettingsCollection>())
            {
                if (c == null || c.name != StatsCollection || !done.Add(c.Pointer)) continue;
                var views = c.m_tableViewSettings;
                if (views == null || views.Count == 0) continue;
                SIDropdownElement<StreamedTableViewSettings> model = null;
                for (int i = 0; i < views.Count; i++)
                    if (views[i]?.PropertyValue != null && views[i].PropertyValue.name == StatsTemplateView) model = views[i];
                model ??= views[views.Count - 1];
                var view = UnityEngine.Object.Instantiate(model.PropertyValue);
                view.name = "PlayerAdaptiveFormationStatsFitnessTable";
                view.hideFlags = HideFlags.DontUnloadUnusedAsset;
                view.m_tableView.m_viewName = new SI.Translation.TranslationID(ViewNameId, "Fitness and Injuries");
                var cols = view.m_tableView.m_tableConfig;
                // Keep FM's position and name columns first and its rating last; ours in between
                StreamedTableView.ColumnConfiguration rating = null, model2 = null;
                for (int i = cols.Count - 1; i >= 0; i--)
                {
                    var id = cols[i].m_columnID;
                    if (id == "picked-position" || id == "player-shortname") { model2 ??= cols[i]; continue; }
                    if (id == "rating") rating = cols[i];
                    cols.RemoveAt(i);
                }
                foreach (var (id, width) in Settings.StatsView)
                    if (kept.ContainsKey(id)) cols.Add(Column(model2 ?? model.PropertyValue.m_tableView.m_tableConfig[0], Prefix + id, width, kept[id].m_defaultWidth));
                if (rating != null) cols.Add(rating);
                var entry = model.MemberwiseClone().Cast<SIDropdownElement<StreamedTableViewSettings>>();
                entry.PropertyValue = view;
                views.Add(entry);
                try { c.RebuildLookup(); } catch (Exception e) { Plugin.L.LogWarning("match columns: view list: " + e.Message); }
                Plugin.L.LogInfo($"match columns: view 'Fitness and Injuries' added to the match stats table ({cols.Count} columns)");
            }
        }

        /// <summary>Copies of the wanted squad-table columns, made while FM's squad table is loaded.</summary>
        private void Keep(TableTemplate players)
        {
            if (!listed) { listed = true; WriteList(players); }
            var rows = players.RowDataList;
            int before = kept.Count;
            foreach (var (id, _) in Want())
            {
                if (kept.ContainsKey(id) || missing.Contains(id)) continue;
                TableTemplate.RowData src = null;
                for (int i = 0; i < rows.Length; i++) if (rows[i].m_id == id) { src = rows[i]; break; }
                if (src == null) { missing.Add(id); Plugin.L.LogWarning($"match columns: there is no FM column '{id}' (see MatchColumns-list.txt)"); continue; }
                var copy = src.MemberwiseClone().Cast<TableTemplate.RowData>();
                copy.m_valueBindings = Remaps(src.m_valueBindings, null, null);
                copy.m_footerValueBindings = Remaps(src.m_footerValueBindings, null, null);
                kept[id] = copy;
            }
            if (kept.Count != before) Plugin.L.LogInfo($"match columns: {kept.Count} columns copied from FM's squad table");
        }

        private static IEnumerable<(string id, float width)> Want()
        {
            foreach (var c in Settings.TeamTalk) yield return c;
            foreach (var c in Settings.StatsView) yield return c;
        }

        /// <summary>Adds the kept columns to a match table, fed by its row's player and team.</summary>
        private int AddRows(TableTemplate to, List<(string id, float width)> wanted, string player, string team)
        {
            var rows = to.RowDataList;
            var add = new List<TableTemplate.RowData>();
            foreach (var (id, _) in wanted)
            {
                if (!kept.TryGetValue(id, out var src)) continue;
                bool there = false;
                for (int i = 0; i < rows.Length; i++) if (rows[i].m_id == Prefix + id) there = true;
                if (there) continue;
                var row = src.MemberwiseClone().Cast<TableTemplate.RowData>();
                row.m_id = Prefix + id;
                row.m_sortBinding = new BindingPath(Move(src.m_sortBinding?.m_path ?? "", player, team));
                row.m_valueBindings = Remaps(src.m_valueBindings, player, team);
                row.m_footerValueBindings = Remaps(src.m_footerValueBindings, null, null);
                add.Add(row);
            }
            if (add.Count == 0) return 0;
            var grown = new Il2CppReferenceArray<TableTemplate.RowData>(rows.Length + add.Count);
            for (int i = 0; i < rows.Length; i++) grown[i] = rows[i];
            for (int i = 0; i < add.Count; i++) grown[rows.Length + i] = add[i];
            to.m_rowData = grown;
            var lookup = to.m_rowDataLookup;
            if (lookup != null) foreach (var r in add) lookup[r.m_id] = r;
            return add.Count;
        }

        /// <summary>A squad-table path for a match table: binding.X becomes player.X, team.X becomes team.X.</summary>
        private static string Move(string path, string player, string team)
        {
            if (string.IsNullOrEmpty(path) || player == null) return path;
            if (path.Equals("team", StringComparison.OrdinalIgnoreCase)) return team;
            if (path.StartsWith("team.", StringComparison.OrdinalIgnoreCase)) return team + path.Substring(4);
            if (path.Equals("binding", StringComparison.OrdinalIgnoreCase)) return player;
            if (path.StartsWith("binding.", StringComparison.OrdinalIgnoreCase)) return player + path.Substring(7);
            return path;
        }

        private static Il2CppSystem.Collections.Generic.List<RemapInfo> Remaps(Il2CppSystem.Collections.Generic.List<RemapInfo> src, string player, string team)
        {
            var list = new Il2CppSystem.Collections.Generic.List<RemapInfo>();
            if (src == null) return list;
            // The interop's List<struct>.Add drops the value; FM's own Add, called through reflection, keeps it
            var add = list.GetIl2CppType().GetMethod("Add");
            for (int i = 0; i < src.Count; i++)
            {
                var m = src[i];
                if (player != null && m.to != null) m.to = new BindingPath(Move(m.to.m_path, player, team));
                var args = new Il2CppReferenceArray<Il2CppSystem.Object>(1);
                args[0] = m;
                add.Invoke(list, args);
            }
            return list;
        }

        private static bool Has(Il2CppSystem.Collections.Generic.List<StreamedTableView.ColumnConfiguration> list, string id)
        {
            for (int i = 0; i < list.Count; i++) if (list[i].m_columnID == id) return true;
            return false;
        }

        private static StreamedTableView.ColumnConfiguration Column(StreamedTableView.ColumnConfiguration template, string id, float width, float fallback)
        {
            var c = template.MemberwiseClone().Cast<StreamedTableView.ColumnConfiguration>();
            c.m_columnID = id;
            if (template.m_columnMetadata != null)
            {
                var m = template.m_columnMetadata.MemberwiseClone().Cast<StreamedTableView.ColumnMetadata>();
                float w = width > 0 ? width : fallback;
                m.m_widthOverride = w;
                m.m_minWidthOverride = w;
                c.m_columnMetadata = m;
            }
            return c;
        }

        /// <summary>MatchColumns-list.txt: every FM squad-table column that can be used.</summary>
        private static void WriteList(TableTemplate players)
        {
            try
            {
                var rows = players.RowDataList;
                var ids = new List<string>();
                for (int i = 0; i < rows.Length; i++) ids.Add($"{rows[i].m_id} ({rows[i].m_defaultWidth:0})");
                ids.Sort(StringComparer.Ordinal);
                ids.InsertRange(0, new[] { "# Columns you can put in MatchColumns.cfg (FM's squad-table columns), with FM's default width.", "# Not all of them may work in match tables; try and see." });
                File.WriteAllLines(System.IO.Path.Combine(Settings.Folder, "MatchColumns-list.txt"), ids);
            }
            catch (Exception e) { Plugin.L.LogWarning("match columns: column list: " + e.Message); }
        }
    }
}
