var UglifyJS_Tools = (function($){
    $(document).ready(function(){
        if (/#demo$/.test(window.location))
            UglifyJS_Tools.demo_app(true);
    });
    function link_ctor(ctor) {
        if (typeof ctor == "string") ctor = UglifyJS[ctor];
        return "<a class='UglifyJS-node' name='AST_" + ctor.TYPE + "' href='javascript:UglifyJS_Tools.ast_node_info(\"AST_" + ctor.TYPE + "\")'>AST_" + ctor.TYPE + "</a>";
    };
    function getProp(name, def) {
        var p = window.getProp("UglifyJS." + name);
        if (p) {
            p = JSON.parse(p);
            for (var i in p) {
                if (!(i in def)) delete p[i];
            }
            return p;
        }
        return def !== undefined ? def : null;
    };
    function setProp(name, val) {
        window.setProp("UglifyJS." + name, JSON.stringify(val));
    };
    return {
        describe_ast: function(container) {
            var out = UglifyJS.OutputStream({ beautify: true, indent_level: 2 });
            function doitem(ctor) {
                out.print(link_ctor(ctor));
                if (ctor.SUBCLASSES.length > 0) {
                    out.space();
                    out.with_block(function(){
                        ctor.SUBCLASSES.forEach(function(ctor, i){
                            out.indent();
                            doitem(ctor);
                            out.newline();
                        });
                    });
                }
            };
            doitem(UglifyJS.AST_Node);
            $(container).html(out + "");
            $(".UglifyJS-node", container).each(function(){
                var ctor = UglifyJS[$(this).attr("name")];
                var w = new DlWidget({
                    element: this,
                    tooltip: (ctor.documentation + "").htmlEscape()
                });
            });
        },
        ast_node_info: function(type) {
            function find_prop(prop) {
                var c = ctor;
                while (c) {
                    if (c.SELF_PROPS.indexOf(prop) >= 0) return c;
                    c = c.BASE;
                }
            };
            var ctor = UglifyJS[type];
            var html = String.buffer();
            html("<p><tt style='font-size: 140%'>", type, "</tt></p>");
            html("<blockquote>", (ctor.documentation + "").htmlEscape(), "</blockquote>");
            if (ctor.BASE) {
                html("<p><b>Inheritance:</b> ");
                var c = ctor.BASE;
                while (c) {
                    if (c !== ctor.BASE) html(" ← ");
                    html(link_ctor(c));
                    c = c.BASE;
                }
            }
            html("<p><b>Properties:</b></p>");
            var dlg = new XDialog({
                title: type,
                resizable: true,
                quitBtn: "destroy"
            });
            html("<table class=\"propdesc\">");
            html("<thead><tr> <td>Name</td> <td>Origin</td> <td>Type</td> <td class=\"wide\">Description</td> </tr></thead>");
            html("<tbody>");
            ctor.PROPS.forEach(function(prop){
                if (/^\$/.test(prop)) return;
                html("<tr>");
                var origin = find_prop(prop);
                var doc = origin.propdoc[prop];
                if (doc) {
                    var m = /^\[(.*?)\]\s*(.*)$/.exec(doc);
                    doc = m[2];
                    var info = m[1];
                    var a = info.split(/\//);
                    var type = a.shift();
                    var hints = {};
                    a.forEach(function(a){ hints[a] = true });
                    html("<td>");
                    if (hints.S)
                        html("<span style='color:red'>");
                    html((prop + "").htmlEscape());
                    if (hints.S)
                        html("</span>");
                    html("</td>");
                    html("<td>", link_ctor(origin), "</td>");
                    html("<td>", type.htmlEscape(), "</td>");
                    html("<td>", doc.htmlEscape(), "</td>");
                } else {
                    html("<td>", (prop + "").htmlEscape(), "</td>");
                    html("<td>", link_ctor(origin), "</td>");
                }
                html("</tr>");
            });
            html("</tbody></tr></thead></table>");
            html("<p>Notes:</p><ul>");
            html("<li>Properties <span style='color:red'>in red</span> are only available after a call to <tt>toplevel.figure_out_scope</tt>.</li>");
            html("<li>An asterisk in the type spec means \"an array of elements of that type\".</li>");
            html("<li>A question mark in the type means \"that type, or null\".</li>");
            html("</ul>");
            var cont = new DlContainer({ parent: dlg, scroll: true, className: "X-InfoCont", fillParent: true });
            cont.setStyle({ padding: "10px 20px "});
            cont.setContent(html.get());
            dlg.setPercentSize(0.7, 0.7);
            dlg.show(true);
        },
        setup_benchmark: function() {
            $.ajax({
                url: "/s/everything.js",
                success: function(code) {
                    var b = new Benchmark.Suite("Compare parsers", {
                        onComplete: function() {
                            console.log(b);
                            b.forEach(function(b){
                                console.log(b.stats.mean);
                                console.log(b.stats.sem);
                            });
                        },
                        onCycle: function(x) {
                            console.log("Cycle: %o", x);
                        },
                        onError: function(x) {
                            console.log("Error: %o", x);
                        }
                    });
                    b.add("Acorn", function(){
                        acorn.parse(code, { locations: true, trackComments: true });
                    });
                    b.add("UglifyJS2", function(){
                        UglifyJS.parse(code);
                    });
                    b.add("Esprima", function(){
                        esprima.parse(code, { loc: true, range: true, comment: true });
                    });
                    alert("Press OK");
                    b.run({ async: true });
                }
            });
        },

        // NOTE: this is Quick'n'Dirty™.
        demo_app: function(demo_maximized) {
            var demo_dlg = new XDialog({
                title: "UglifyJS demo",
                resizable: true,
                quitBtn: "destroy",
            });
            var original = new DlEntry({ type: "textarea", emptyText: "Original source here", className: "X-Code-Editor" });
            var minified = new DlEntry({ type: "textarea", emptyText: "Minified source here", className: "X-Code-Editor" });
            original.getElement().spellcheck = false;
            demo_dlg._focusedWidget = original;
            minified.getElement().spellcheck = false;
            var middle = new DlLayout();
            middle.packWidget(original, { pos: "left", fill: "50%", after: 5 });
            middle.packWidget(minified, { pos: "right", fill: "*" });
            var checklist = DlRadioGroup.get();
            checklist.maxChecked(null);
            var ymacs = null;
            var keymap = new (DEFINE_HIDDEN_CLASS(null, Ymacs_Keymap_JS().constructor, function(D, P){
                D.KEYS = {
                    "C-x C-s": Ymacs_Interactive(function(){
                        w.tb_buttons.uglify.keyClicked();
                    }),
                    "ENTER": "newline_and_indent"
                };
            }));
            checklist.on("onChange", function(){
                w.tb_buttons.uglify.keyClicked();
            });
            function getYmacs() {
                if (!ymacs) {
                    ymacs = new Ymacs();
                    ymacs.setColorTheme(getColorTheme() == "light"
                                        ? [ "light", "whiteboard" ]
                                        : [ "dark", "mishoo2" ]);
                    var buf = ymacs.getActiveBuffer();
                    buf.pushKeymap(keymap);
                    buf.cmd("javascript_mode");
                    buf.setCode(original.getValue());
                    middle.replaceWidget(original, ymacs);
                    middle.doLayout();
                    ymacs.on("onDestroy", function(){
                        middle.replaceWidget(ymacs, original);
                        middle.doLayout();
                        ymacs = null;
                    });
                    ymacs.on("onDeleteBuffer", function(){
                        original.setValue(ymacs.getActiveBuffer().getCode());
                        ymacs.destroy();
                    });
                    buf.on("onLineChange onInsertLine onDeleteLine onResetCode onTextInsert onTextDelete".qw(), function(){
                        uglify_as_i_type(false);
                    });
                }
                return ymacs;
            };
            var compressor_options_defaults = {
                sequences     : true,
                properties    : true,
                dead_code     : true,
                drop_debugger : true,
                unsafe        : true,
                unsafe_comps  : false,
                conditionals  : true,
                comparisons   : true,
                evaluate      : true,
                booleans      : true,
                loops         : true,
                unused        : true,
                hoist_funs    : true,
                hoist_vars    : false,
                if_return     : true,
                join_vars     : true,
                cascade       : true,
                side_effects  : true,
                warnings      : true,
            };
            var compressor_options = getProp("demo.compressor_options", compressor_options_defaults);
            var beautifier_options_defaults = {
                indent_start  : 0,
                indent_level  : 4,
                quote_keys    : false,
                space_colon   : true,
                ascii_only    : false,
                inline_script : false,
                width         : 80,
                max_line_len  : 32000,
                screw_ie8     : false,
                beautify      : false,
                bracketize    : false,
                comments      : false,
                semicolons    : false
            };
            var beautifier_options = getProp("demo.beautifier_options", beautifier_options_defaults);
            function uglify(show_parse_error) {
                if (show_parse_error) getYmacs();
                var code = ymacs ? ymacs.getActiveBuffer().getCode() : original.getValue();
                var themap = UglifyJS.SourceMap();
                try {
                    var ast = UglifyJS.parse(code);
                } catch(ex) {
                    if (ex instanceof UglifyJS.JS_Parse_Error) {
                        if (show_parse_error) {
                            XMSG.addMsg("error", "Parse error:<br />" + ex.message);
                            if (ymacs) {
                                ymacs.focus();
                                ymacs.getActiveBuffer().cmd("goto_char", ex.pos);
                            } else {
                                original.setSelectionRange(ex.pos, ex.pos);
                            }
                        } else {
                            statusbar.setContent("<span style='color:red'>Parse error: " + (ex.message + "").htmlEscape());
                        }
                        return;
                    }
                    throw ex;
                }
                var warnings = [], save_warn_function = UglifyJS.AST_Node.warn_function;
                if (compressor_options.warnings) {
                    UglifyJS.AST_Node.warn_function = function(warn) {
                        warnings.push(warn);
                    };
                }
                var opts = checklist.getValue().toHash(true);
                if (opts.lint || opts.compress) {
                    ast.figure_out_scope();
                }
                if (opts.lint) {
                    ast.scope_warnings();
                }
                if (opts.compress) {
                    ast = ast.transform(UglifyJS.Compressor(compressor_options));
                }
                if (opts.mangle) {
                    ast.figure_out_scope();
                    ast.compute_char_frequency();
                    ast.mangle_names();
                }
                var codegen = Object.makeDeepCopy(beautifier_options);
                codegen.source_map = themap;
                if (opts.beautify) {
                    codegen.beautify = true;
                }
                try {
                    var output = ast.print_to_string(codegen);
                } catch(ex) {
                    console.log(ex);
                    console.log(ex.stack);
                }
                UglifyJS.AST_Node.warn_function = save_warn_function;
                minified.setValue(output);
                statusbar.setContent(String.template("Original size: <b>$init characters</b>.  Uglified size: <b>$final characters</b> (diff: $diff).")({
                    "final": output.length,
                    "init": code.length,
                    "diff": output.length - code.length
                }));
                minified.removeAllListeners("onMouseUp");
                minified.addEventListener("onMouseUp", function(ev){
                    var loc = minified.getSelectionRange();
                    var code = minified.getValue();
                    var line = 1, col = 0;
                    for (var i = 0; i < loc.start && i < code.length; ++i) {
                        if (/[\r\n]/.test(code.charAt(i))) line++, col = 0;
                        else col++;
                    }
                    var map = new MOZ_SourceMap.SourceMapConsumer(themap.toString());
                    var op = map.originalPositionFor({ line: line, column: col });

                    var buf = getYmacs().getActiveBuffer();
                    var pos = buf._rowColToPosition(op.line - 1, op.column);
                    buf.setMinibuffer("Position: " + pos + (op.name ? ", name: " + op.name : ""));
                    buf.forAllFrames(function(f){
                        f.focus();
                        f._redrawCaret(true);
                    });
                    buf.clearTransientMark();
                    buf.cmd("goto_char", pos);
                    buf.cmd("recenter_top_bottom");
                    if (op.name) {
                        buf.ensureTransientMark();
                        buf.cmd("forward_char", op.name.length);
                        buf.ensureTransientMark();
                    }
                });
                if (ymacs) ymacs.focus();
                else original.focus();
                if (warnings.length > 0) {
                    if (warnings_dlg) {
                        warnings_dlg.resetWarnings(warnings);
                    }
                    else show_warnings = function() {
                        var dlg = warnings_dlg = new DlContainer();
                        var set = new DlRecordCache();
                        var grid = new DlDataGrid({
                            cols: [
                                { id: "msg", label: "Message", fill: 1 },
                                { id: "line", label: "Line", width: 50 },
                                { id: "col", label: "Col", width: 50 }
                            ],
                            data: set
                        });
                        XDialog.createStandardLayout({
                            toolbar: [
                                function() {
                                    new DlLabel({ parent: this, label: "<b>Accumulated warnings</b>" })
                                },
                                "fill",
                                { label: "Close", icon: "Icon-Cancel", action: dlg.$("destroy") }
                            ],
                            content: grid
                        }, dlg);
                        dlg.resetWarnings = function(warnings) {
                            set._data = warnings.map(function(msg, i){
                                var m = /^(.*)\s*\[\s*(.*?)\s*:\s*(.*?)\s*,\s*(.*?)\s*\]/.exec(msg);
                                var line, col;
                                if (m) {
                                    msg = m[1];
                                    line = m[3];
                                    col = m[4];
                                }
                                return new DlRecord({
                                    data: { id: i, msg: msg, line: +line, col: +col }
                                });
                            });
                            set._init();
                            grid.resetIDS(set.getAllIds());
                            grid.displayPage(0);
                        };
                        dlg.resetWarnings(warnings);
                        grid._selection.on("onChange onReset".qw(), function(){
                            var rec = set.get(this.getFirst());
                            if (rec) {
                                getYmacs();
                                var buf = ymacs.getActiveBuffer();
                                ymacs.focus();
                                buf.cmd("goto_line", rec.get("line"));
                                buf.cmd("move_to_column", rec.get("col"));
                                buf.cmd("recenter_top_bottom");
                            }
                        });
                        dlg.on("onDestroy", function(){
                            warnings_dlg = null;
                            middle.replaceWidget(this, minified);
                            middle.doLayout();
                            (function() {
                                if (ymacs) ymacs.focus();
                                else original.focus();
                            }).delayed(10);
                        });
                        middle.replaceWidget(minified, dlg);
                        middle.doLayout();
                    };
                    w.tb_buttons.warnings.display(true);
                    if (show_parse_error)
                        w.tb_buttons.warnings.flash();
                } else {
                    if (warnings_dlg) warnings_dlg.destroy();
                    w.tb_buttons.warnings.display(false);
                }
            };
            var uglify_as_i_type = function() {
                if (as_i_type.checked()) {
                    uglify(false);
                }
            }.clearingTimeout(250);
            original.addEventListener(["onKeyPress", "onKeyDown"], uglify_as_i_type);
            var w = demo_dlg.createStandardLayout({
                toolbar: [
                    { id: "uglify", label: "Uglify!", tooltip: "Uglify code on the left, put result on the right", icon: "Icon-Refresh", focusable: true, action: function(){
                        uglify(true);
                    } },
                    { id: "warnings", label: "Warnings", icon: "Icon-Warning", action: function() {
                        show_warnings();
                    }},
                    "sep",
                    function() {
                        new DlCheckbox({ parent: this, value: "lint", label: "Scope warnings", group: checklist });
                        new DlCheckbox({ parent: this, value: "compress", label: "Compress", group: checklist });
                        new DlCheckbox({ parent: this, value: "mangle", label: "Mangle", group: checklist });
                        new DlCheckbox({ parent: this, value: "beautify", label: "Beautify", group: checklist });
                    },
                    "sep",
                    function() {
                        as_i_type = new DlCheckbox({ parent: this, label: "As I type" });
                    },
                    "fill",
                    { label: "Copy", icon: "Icon-ClipboardCopy", tooltip: "Select the compressed text so you can copy it to clipboard", action: function(){
                        minified.focus();
                        minified.select();
                    }},
                    "sep",
                    { label: "Compressor...", icon: "Icon-Configure", tooltip: "Configure compressor options", action: compressor_options_dialog },
                    { label: "Codegen...", icon: "Icon-Print", tooltip: "Configure code generator options", action: beautifier_options_dialog },
                    "sep",
                    { label: "Help", icon: "Icon-Help", action: show_help }
                ],
                content: middle,
                bottombar: [
                    function() {
                        statusbar = new DlLabel({ parent: this });
                    },
                    "fill",
                    XDialog.BUTTONS.close
                ]
            });
            w.tb_buttons.warnings.display(false);
            var statusbar, as_i_type, show_warnings, warnings_dlg;
            checklist.setValue("compress mangle".qw());
            demo_dlg.setPercentSize(0.8, 0.8);
            demo_dlg.show(true);
            if (demo_maximized) demo_dlg.maximize(true);

            function show_help() {
                var dlg = new XDialog({
                    parent    : demo_dlg,
                    title     : "Information",
                    quitBtn   : "destroy",
                    resizable : true,
                    modal     : true
                });
                var cont = new DlContainer({ className: "X-InfoCont" });
                cont.setContent($("#demo-notes").html());
                var never_again;
                dlg.createStandardLayout({
                    content: cont,
                    bottombar: [
                        function() {
                            never_again = new DlCheckbox({ parent: this, label: "Don't show this at startup", checked: getProp("demo.no_tips") });
                        },
                        "fill",
                        { label: "OK".fixedWidth("5em"), action: function(){
                            setProp("demo.no_tips", never_again.checked());
                            dlg.destroy();
                        } }
                    ]
                });
                dlg.setSize({ x: 450, y: 350 });
                dlg.show(true);
            }

            // help.
            if (!getProp("demo.no_tips")) show_help();

            function compressor_options_dialog() {
                var dlg = new XDialog({
                    title: "Compressor options",
                    parent: demo_dlg,
                    modal: true,
                    quitBtn: "destroy"
                });
                var cont = new DlContainer({ scroll: true });
                cont.setStyle({ maxHeight: "20em" });
                cont.setSize({ x: 500 });
                var form = new XGenericForm({
                    parent: cont,
                    fields: [
                        { id: "warnings", type: "checkbox", label: "Display warnings" },
                        { id: "sequences", type: "checkbox", label: "Optimize sequences" },
                        { id: "properties", type: "checkbox", label: "Optimize property access" },
                        { id: "dead_code", type: "checkbox", label: "Discard unreachable code" },
                        { id: "drop_debugger", type: "checkbox", label: "Drop debugger statements" },
                        { id: "unsafe", type: "checkbox", label: "Unsafe optimizations" },
                        { id: "unsafe_comps", type: "checkbox", label: "More unsafe (!(a <= b) → a > b)" },
                        { id: "conditionals", type: "checkbox", label: "Optimize conditionals and IF-s" },
                        { id: "comparisons", type: "checkbox", label: "Optimize comparisons" },
                        { id: "evaluate", type: "checkbox", label: "Evaluate constant expressions" },
                        { id: "booleans", type: "checkbox", label: "Optimize booleans" },
                        { id: "loops", type: "checkbox", label: "Optimize loops" },
                        { id: "unused", type: "checkbox", label: "Discard unused variables/functions" },
                        { id: "hoist_funs", type: "checkbox", label: "Hoist function declarations" },
                        { id: "hoist_vars", type: "checkbox", label: "Hoist variable declarations" },
                        { id: "if_return", type: "checkbox", label: "Optimize IF followed by RETURN/CONTINUE" },
                        { id: "join_vars", type: "checkbox", label: "Join consecutive var statements" },
                        { id: "cascade", type: "checkbox", label: "Cascade" },
                        { id: "side_effects", type: "checkbox", label: "Discard side-effect-free statements" },
                    ]
                });
                dlg.createStandardLayout({
                    content: cont,
                    fixed: true,
                    bottombar: [
                        { label: "Defaults".fixedWidth("5em"), action: function() {
                            form.setValue(compressor_options_defaults);
                        }},
                        "fill",
                        { label: "Save".fixedWidth("5em"), action: function() {
                            compressor_options = form.getValue();
                            setProp("demo.compressor_options", compressor_options);
                            w.tb_buttons.uglify.keyClicked();
                            dlg.destroy();
                        }}
                    ]
                });
                form.setValue(compressor_options);
                dlg.show(true);
            };
            function beautifier_options_dialog() {
                var dlg = new XDialog({
                    title: "Code generator options",
                    parent: demo_dlg,
                    modal: true,
                    quitBtn: "destroy"
                });
                var form = new XGenericForm({
                    fields: [
                        { id: "indent_start", type: "spinner", integer: true, min: 0, label: "Indent start:" },
                        { id: "indent_level", type: "spinner", integer: true, min: 0, label: "Indent level:" },
                        { id: "width", type: "spinner", integer: true, min: 0, label: "Preferred line width:" },
                        { id: "max_line_len", type: "spinner", integer: true, min: 0, label: "Maximum line length:" },
                        null,
                        { id: "quote_keys", type: "checkbox", label: "Quote keys in object literals" },
                        { id: "space_colon", type: "checkbox", label: "Add space after colon" },
                        { id: "ascii_only", type: "checkbox", label: "Escape non-ASCII characters in strings and regexps" },
                        { id: "inline_script", type: "checkbox", label: "Escape occurrences of </script>".htmlEscape() },
                        { id: "screw_ie8", type: "checkbox", label: "Screw IE8 and older" },
                        { id: "bracketize", type: "checkbox", label: "Always add brackets" },
                        { id: "comments", type: "checkbox", label: "Keep comments in the output" },
                        { id: "semicolons", type: "checkbox", label: "Use semicolons" },
                    ]
                });
                dlg.createStandardLayout({
                    content: form,
                    fixed: true,
                    bottombar: [
                        { label: "Defaults".fixedWidth("5em"), action: function() {
                            form.setValue(beautifier_options_defaults);
                        }},
                        "fill",
                        { label: "Save".fixedWidth("5em"), action: function() {
                            beautifier_options = form.getValue();
                            setProp("demo.beautifier_options", beautifier_options);
                            w.tb_buttons.uglify.keyClicked();
                            dlg.destroy();
                        }}
                    ]
                });
                form.setValue(beautifier_options);
                dlg.show(true);
            };
        },

        display_stats: function() {
            var data = window.UGLIFY_STATS;
            var results = data.results;
            var compressors = data.commands;
            var n_cmd = data.commands.length;
            var html = String.buffer("<table class='uglifyjs-stats' align='center'>");
            html("<thead>");
            html("<tr><td>File</td><td>Orig.</td><td>Compressor</td><td>Min.</td><td>Gzip</td><td>Time</td></tr>");
            html("</thead>");
            compressors.sort(function(a, b){
                if (a == "UglifyJS2") return -1;
                if (b == "UglifyJS2") return 1;
                if (a == "UglifyJS1") return -1;
                if (b == "UglifyJS1") return 1;
                return a < b ? -1 : a > b ? 1 : 0;
            });
            Object.keys(results).sort().forEach(function(file){
                var stats = results[file];
                html("<tr>");
                html("<td rowspan='", n_cmd + 1, "'>", file, "</td>");
                html("<td rowspan='", n_cmd + 1, "'>", stats.orig, "</td>");
                var best_comp = stats.best_comp;
                var best_gzip = stats.best_gzip;
                var best_time = stats.best_time;
                var res = stats.results;
                compressors.forEach(function(cmd){
                    var s = res[cmd];
                    var class_comp = best_comp == cmd ? "best" : "";
                    var class_gzip = best_gzip == cmd ? "best" : "";
                    var class_time = best_time == cmd ? "best" : "";
                    html("<tr class='", cmd, "'>");
                    html("<td>", cmd, "</td>");
                    html("<td class='", class_comp, "'>", s.comp, "</td>");
                    html("<td class='", class_gzip, "'>", s.gzip, "</td>");
                    html("<td class='", class_time, "'>", parseFloat(s.time).toFixed(3), "s</td>");
                    html("</tr>");
                });
                html("</tr><tr><td class='separator' colspan='6'></td></tr>");
            });
            html("</table>");
            document.write(html.get());
        },

        display_stat_charts: function() {
            var data = window.UGLIFY_STATS;
            var compressors = data.commands;
            var colours = [ "#cc2222", "#22cc22", "#8888cc", "#22cccc" ];
            var files = Object.keys(data.results).sort();
            function createStats(PROP) {
                var cont = new DlContainer();
                var series = files.toHash(function(){ return [] });
                files.forEach(function(file){
                    compressors.forEach(function(cmd){
                        var v = parseFloat(data.results[file].results[cmd][PROP]);
                        if (!isNaN(v))
                            series[file].push(v);
                        else
                            series[file].push(0);
                    });
                });
                var x = Object.map(series, function(data, cmd){
                    return data;
                });
                cont.on("onResize", function(){
                    cont.destroyChildWidgets();
                    new Ico.BarGraph( cont.getElement(), x, {
                        grid: true,
                        colours: colours,
                    });
                });
                return cont;
            };
            var dlg = new XDialog({
                title: "UglifyJS charts",
                resizable: true,
                quitBtn: "destroy"
            });
            var tabs = new DlTabs();
            tabs.addTab(createStats("comp"), "Minified (bytes)");
            tabs.addTab(createStats("gzip"), "Gzipped (bytes)");
            tabs.addTab(createStats("time"), "Speed (seconds)");
            dlg.createStandardLayout({
                content: tabs,
                bottombar: [
                    function() {
                        var self = this;
                        new DlLabel({ parent: self, label: "Legend:" });
                        compressors.forEach(function(cmd, i){
                            var l = new DlLabel({ parent: self, label: cmd });
                            l.setStyle({
                                padding: "3px 4px",
                                background: colours[i]
                            });
                        });
                    },
                    "filler",
                    XDialog.BUTTONS.close
                ],
            });
            dlg.setInnerSize({ x: 640, y: 480 });
            dlg.show(true);
        }
    };
})($);

Ymacs_Keymap_JS().defineKeys({
    "C-c C-e" : Ymacs_Interactive(function() {
        var code = this.getCode();
        try {
            var ast = UglifyJS.parse(code);
            this.cmd("eval_buffer");
            this.signalInfo("Executed! Check developer console for any messages.");
        } catch(ex) {
            if (ex instanceof UglifyJS.JS_Parse_Error) {
                this.signalError("Parse error<br /><br />" + (ex.message + "").htmlEscape() + "<br /><br />line: " + ex.line + ", col: " + ex.col, true);
                this.cmd("goto_char", ex.pos);
            }
        }
    })
});

MOZ_SourceMap = window.sourceMap;
