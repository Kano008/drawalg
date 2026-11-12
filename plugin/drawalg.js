/**
 * drawalg — draw.io için algoritma akış diyagramı eklentisi.
 *
 * - "Algoritma" paleti: TANIMLA, OKU, İŞLEM, YAZDIR, KARAR (if), DÖNGÜ (for)
 * - Her sayfa otomatik olarak START ve STOP elipsleriyle başlar.
 * - Eklenen her adım akışa yerleştirilir, oklar ve yerleşim otomatik yapılır.
 *
 * Akışın yapısı sayfanın kök hücresinde ("drawalg" özniteliği) JSON olarak
 * saklanır; hücreler her değişiklikte bu yapıdan yeniden yerleştirilir.
 */
(function ()
{
	function boot()
	{
		if (typeof Draw === 'undefined' || typeof Draw.loadPlugin !== 'function')
		{
			setTimeout(boot, 100);
			return;
		}

		if (window.__drawalgLoaded)
		{
			return;
		}

		window.__drawalgLoaded = true;
		Draw.loadPlugin(drawalgPlugin);
	}

	boot();

	function drawalgPlugin(ui)
	{
		var graph = ui.editor.graph;
		var model = graph.getModel();

		// ------------------------------------------------------------------
		// Sabitler ve stiller
		// ------------------------------------------------------------------
		var GAP = 40;          // ardışık adımlar arasındaki dikey boşluk
		var FONT = 12;
		var X0 = 400;          // akışın dikey ekseni
		var Y0 = 40;           // START'ın üst kenarı
		var PFX = 'da-';

		var LOCK = 'drawalg=1;movable=0;resizable=0;rotatable=0;connectable=0;cloneable=0;';
		var BASE = 'html=1;whiteSpace=wrap;fontSize=' + FONT + ';' + LOCK;
		var NODELETE = 'deletable=0;';

		var STYLE = {
			start: 'ellipse;' + BASE + NODELETE,
			stop: 'ellipse;' + BASE + NODELETE,
			tanimla: 'shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;size=20;' + BASE,
			oku: 'shape=card;size=25;' + BASE,
			islem: 'rounded=0;' + BASE,
			yazdir: 'shape=document;size=0.25;boundedLbl=1;' + BASE,
			'if': 'rhombus;' + BASE,
			forpart: 'rounded=0;' + BASE,
			label: 'text;html=1;align=center;verticalAlign=middle;strokeColor=none;fillColor=none;fontSize=' + FONT + ';' +
				LOCK + NODELETE + 'editable=0;selectable=0;',
			merge: 'shape=waypoint;size=1;fillColor=none;strokeColor=none;perimeter=centerPerimeter;' +
				LOCK + NODELETE + 'editable=0;selectable=0;pointerEvents=0;',
			edge: 'edgeStyle=none;rounded=0;html=1;endFill=1;' + LOCK + NODELETE + 'editable=0;bendable=0;'
		};

		var SIMPLE = {tanimla: 1, oku: 1, islem: 1, yazdir: 1};

		var TYPES = [
			{type: 'tanimla', title: 'TANIMLA', hint: 'Değişken tanımlama'},
			{type: 'oku', title: 'OKU', hint: 'Kullanıcıdan değer okuma'},
			{type: 'islem', title: 'İŞLEM', hint: 'İşlem / atama'},
			{type: 'yazdir', title: 'YAZDIR', hint: 'Ekrana yazdırma'},
			{type: 'if', title: 'İF', hint: 'Karar — False solda, True sağda'},
			{type: 'for', title: 'FOR', hint: 'Döngü — for (ifade1; ifade2; ifade3)'}
		];

		// ------------------------------------------------------------------
		// Yardımcılar
		// ------------------------------------------------------------------
		function esc(s)
		{
			return mxUtils.htmlEntities(s, false);
		}

		function newId()
		{
			return Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
		}

		function newBlock(type)
		{
			var b = {id: newId(), type: type};

			if (type === 'if')
			{
				b.label = esc('koşul');
				b.no = [];
				b.yes = [];
			}
			else if (type === 'for')
			{
				b.init = 'ifade1';
				b.cond = 'ifade2';
				b.step = 'ifade3';
				b.body = [];
			}
			else
			{
				b.label = {tanimla: 'değişkenler', oku: 'değişkenler', islem: 'işlem', yazdir: esc('"çıktı"')}[type];
			}

			return b;
		}

		function isDa(cell)
		{
			return cell != null && typeof cell.id === 'string' && cell.id.indexOf(PFX) === 0;
		}

		// Hücre etiketini düz metin olarak döndürür (HTML etiketleri ayıklanır)
		function plain(html)
		{
			if (html == null)
			{
				return '';
			}

			html = String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '\n');

			if (html.indexOf('<') < 0 && html.indexOf('&') < 0)
			{
				return html;
			}

			try
			{
				var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
				return doc.body.textContent || '';
			}
			catch (e)
			{
				return html;
			}
		}

		function rawValue(cell)
		{
			var v = cell.value;

			if (v != null && typeof v === 'object' && v.getAttribute)
			{
				return v.getAttribute('label') || '';
			}

			return v != null ? String(v) : '';
		}

		// Etiket metni: hücre varsa hücreden, yoksa modeldeki değerden
		function textOf(cellId, fallback)
		{
			var c = model.getCell(cellId);
			return plain(c != null ? rawValue(c) : fallback).replace(/\n+$/, '');
		}

		function measure(text)
		{
			var lines = String(text || '').split('\n');
			var w = 0;

			for (var i = 0; i < lines.length; i++)
			{
				var s = mxUtils.getSizeForString(lines[i] || ' ', FONT, 'Helvetica');
				w = Math.max(w, s.width);
			}

			return {w: Math.ceil(w), h: Math.ceil(lines.length * FONT * 1.35), lines: lines.length};
		}

		function snap(v)
		{
			return Math.ceil(v / 10) * 10;
		}

		// ------------------------------------------------------------------
		// Model (sayfa kök hücresinde JSON)
		// ------------------------------------------------------------------
		function readModel()
		{
			var root = model.getRoot();
			var v = (root != null) ? root.value : null;

			if (v != null && typeof v === 'object' && v.getAttribute)
			{
				var s = v.getAttribute('drawalg');

				if (s)
				{
					try
					{
						var m = JSON.parse(s);

						if (m != null && m.main instanceof Array)
						{
							return m;
						}
					}
					catch (e)
					{
						// yoksay
					}
				}
			}

			return null;
		}

		function writeModel(m)
		{
			var root = model.getRoot();
			var v = root.value;
			var json = JSON.stringify(m);
			var obj;

			if (v != null && typeof v === 'object' && v.cloneNode)
			{
				if (v.getAttribute('drawalg') === json)
				{
					return;
				}

				obj = v.cloneNode(true);
			}
			else
			{
				obj = mxUtils.createXmlDocument().createElement('object');
			}

			obj.setAttribute('drawalg', json);
			model.setValue(root, obj);
		}

		function seqByKey(m, key)
		{
			if (key === 'main')
			{
				return m.main;
			}

			var p = key.split(':');
			var f = findBlock(m, p[0]);

			return (f != null && f.block[p[1]] instanceof Array) ? f.block[p[1]] : null;
		}

		function findBlock(m, id)
		{
			function walk(seq, key)
			{
				for (var i = 0; i < seq.length; i++)
				{
					var b = seq[i];

					if (b.id === id)
					{
						return {block: b, seq: seq, key: key, idx: i};
					}

					var kids = b.type === 'if' ? ['no', 'yes'] : (b.type === 'for' ? ['body'] : []);

					for (var k = 0; k < kids.length; k++)
					{
						var r = walk(b[kids[k]], b.id + ':' + kids[k]);

						if (r != null)
						{
							return r;
						}
					}
				}

				return null;
			}

			return walk(m.main, 'main');
		}

		// Hücre kimlikleri
		function ids(m, b)
		{
			var p = PFX + m.uid + '-' + b.id;

			if (b.type === 'if')
			{
				return {main: p, merge: p + '-m', lf: p + '-lf', lt: p + '-lt'};
			}
			else if (b.type === 'for')
			{
				return {main: p + '-i', init: p + '-i', step: p + '-s', cond: p + '-c'};
			}

			return {main: p};
		}

		function startId(m)
		{
			return PFX + m.uid + '-start';
		}

		function stopId(m)
		{
			return PFX + m.uid + '-stop';
		}

		// cellId -> {block, field}
		function cellMap(m)
		{
			var map = {};

			function walk(seq)
			{
				for (var i = 0; i < seq.length; i++)
				{
					var b = seq[i];
					var c = ids(m, b);

					if (b.type === 'if')
					{
						map[c.main] = {block: b.id, field: 'label'};
						map[c.merge] = {block: b.id};
						map[c.lf] = {block: b.id};
						map[c.lt] = {block: b.id};
						walk(b.no);
						walk(b.yes);
					}
					else if (b.type === 'for')
					{
						map[c.init] = {block: b.id, field: 'init'};
						map[c.step] = {block: b.id, field: 'step'};
						map[c.cond] = {block: b.id, field: 'cond'};
						walk(b.body);
					}
					else
					{
						map[c.main] = {block: b.id, field: 'label'};
					}
				}
			}

			walk(m.main);
			map[startId(m)] = {start: true};
			map[stopId(m)] = {stop: true};

			return map;
		}

		// ------------------------------------------------------------------
		// Ölçüm (her blok dikey eksene göre: L sol genişlik, R sağ genişlik, H yükseklik)
		// ------------------------------------------------------------------
		function sizeOf(m, b)
		{
			var t = measure(textOf(ids(m, b).main, b.label));
			var w, h;

			if (b.type === 'tanimla')
			{
				w = Math.max(120, t.w + 60);
				h = Math.max(60, t.h + 30);
			}
			else if (b.type === 'oku')
			{
				w = Math.max(100, t.w + 40);
				h = Math.max(80, t.h + 40);
			}
			else if (b.type === 'yazdir')
			{
				w = Math.max(120, t.w + 30);
				h = Math.max(70, t.h + 45);
			}
			else if (b.type === 'if')
			{
				w = Math.max(140, Math.round(t.w * 1.7) + 40);
				h = Math.max(80, t.h * 2 + 30);
			}
			else
			{
				w = Math.max(120, t.w + 30);
				h = Math.max(60, t.h + 30);
			}

			return {w: snap(w), h: snap(h)};
		}

		function measureSeq(m, seq)
		{
			var r = {L: 0, R: 0, H: 0, n: seq.length, items: []};

			for (var i = 0; i < seq.length; i++)
			{
				var mb = measureBlock(m, seq[i]);
				r.items.push(mb);
				r.L = Math.max(r.L, mb.L);
				r.R = Math.max(r.R, mb.R);
				r.H += mb.H + (i > 0 ? GAP : 0);
			}

			return r;
		}

		function measureBlock(m, b)
		{
			if (SIMPLE[b.type])
			{
				var s = sizeOf(m, b);
				return {L: s.w / 2, R: s.w / 2, H: s.h, s: s};
			}
			else if (b.type === 'if')
			{
				var d = sizeOf(m, b);
				var no = measureSeq(m, b.no);
				var yes = measureSeq(m, b.yes);
				var arm = d.w / 2 + 50;
				var xl = Math.max(arm, no.n > 0 ? no.R + 30 : 0);
				var xr = Math.max(arm, yes.n > 0 ? yes.L + 30 : 0);
				var top = d.h + 30;
				var mergeY = top + Math.max(no.H, yes.H) + 30;

				return {L: xl + no.L, R: xr + yes.R, H: mergeY, d: d, no: no, yes: yes,
					xl: xl, xr: xr, top: top, mergeY: mergeY};
			}
			else if (b.type === 'for')
			{
				var c = ids(m, b);
				var ti = measure(textOf(c.init, b.init));
				var ts = measure(textOf(c.step, b.step));
				var tc = measure(textOf(c.cond, b.cond));
				var w1 = snap(Math.max(80, ti.w + 24));
				var w2 = snap(Math.max(80, ts.w + 24));
				var extra = Math.max(0, snap(tc.w + 24) - (w1 + w2));
				w1 += Math.ceil(extra / 20) * 10;
				w2 += Math.ceil(extra / 20) * 10;
				var rh = Math.max(40, snap(Math.max(ti.h, ts.h) + 16));
				var ch = Math.max(40, snap(tc.h + 16));
				var boxH = rh + ch;
				var body = measureSeq(m, b.body);
				var bx = w2 + 40 + body.L;
				var bodyTop = boxH + 40;
				var last = b.body.length > 0 ? b.body[b.body.length - 1] : null;
				var lastSimple = last == null || SIMPLE[last.type];
				var loopX = body.n > 0 ? bx + body.R + 30 : w2 + 40;
				var H = body.n > 0 ? bodyTop + body.H + (lastSimple ? 10 : 30) : boxH;

				return {L: w1, R: loopX + 10, H: H, w1: w1, w2: w2, rh: rh, ch: ch, boxH: boxH,
					body: body, bx: bx, bodyTop: bodyTop, loopX: loopX};
			}

			return {L: 60, R: 60, H: 60};
		}

		// ------------------------------------------------------------------
		// Yerleşim: modelden hücre tanımları üretir
		// ------------------------------------------------------------------
		function layout(m)
		{
			var out = [];
			var labels = {};

			function vtx(id, style, value, x, y, w, h)
			{
				out.push({id: id, edge: false, style: style, value: value, x: x, y: y, w: w, h: h});
			}

			function edge(id, style, src, trg, points)
			{
				out.push({id: id, edge: true, style: style, src: src, trg: trg, points: points || []});
			}

			function anchorStyle(a, b)
			{
				return 'exitX=' + a.cx + ';exitY=' + a.cy + ';exitDx=0;exitDy=0;exitPerimeter=0;' +
					'entryX=' + b.cx + ';entryY=' + b.cy + ';entryDx=0;entryDy=0;entryPerimeter=0;';
			}

			function slotEdge(key, idx, src, trg, points, arrow)
			{
				var st = STYLE.edge + 'endArrow=' + (arrow ? 'classic' : 'none') + ';' + anchorStyle(src, trg) +
					'daSeq=' + key + ';daIdx=' + idx + ';';
				edge(PFX + m.uid + '-e-' + key.replace(':', '-') + '-' + idx, st, src.id, trg.id, points);
			}

			// Bir blok yerleştirir; giriş ve çıkış bağlantı noktalarını döndürür
			function emitBlock(b, mb, cx, y)
			{
				var c = ids(m, b);

				if (SIMPLE[b.type])
				{
					var w = mb.s.w, h = mb.s.h;
					vtx(c.main, STYLE[b.type], b.label, cx - w / 2, y, w, h);

					return {
						entry: {id: c.main, cx: 0.5, cy: 0, x: cx, y: y},
						exit: {id: c.main, cx: 0.5, cy: 1, x: cx, y: y + h, bottom: y + h,
							side: {id: c.main, cx: 1, cy: 0.5, x: cx + w / 2, y: y + h / 2}}
					};
				}
				else if (b.type === 'if')
				{
					var d = mb.d;
					var cy = y + d.h / 2;
					vtx(c.main, STYLE['if'], b.label, cx - d.w / 2, y, d.w, d.h);

					var my = y + mb.mergeY;
					vtx(c.merge, STYLE.merge, '', cx - 1, my - 1, 2, 2);

					// False / True yazıları
					var lw = 50, lh = 20;
					var lfx = cx - (mb.xl + d.w / 2) / 2;
					var ltx = cx + (mb.xr + d.w / 2) / 2;
					vtx(c.lf, STYLE.label, 'False', lfx - lw / 2, cy - lh - 2, lw, lh);
					vtx(c.lt, STYLE.label, 'True', ltx - lw / 2, cy - lh - 2, lw, lh);

					var merge = {id: c.merge, cx: 0.5, cy: 0.5, x: cx, y: my};

					emitSeq(b.no, mb.no, b.id + ':no', cx - mb.xl, y + mb.top,
						{id: c.main, cx: 0, cy: 0.5, x: cx - d.w / 2, y: cy}, merge, 'merge');
					emitSeq(b.yes, mb.yes, b.id + ':yes', cx + mb.xr, y + mb.top,
						{id: c.main, cx: 1, cy: 0.5, x: cx + d.w / 2, y: cy}, merge, 'merge');

					return {
						entry: {id: c.main, cx: 0.5, cy: 0, x: cx, y: y},
						exit: {id: c.merge, cx: 0.5, cy: 0.5, x: cx, y: my, bottom: my}
					};
				}
				else if (b.type === 'for')
				{
					var w1 = mb.w1, w2 = mb.w2;
					vtx(c.init, STYLE.forpart, b.init, cx - w1, y, w1, mb.rh);
					vtx(c.step, STYLE.forpart, b.step, cx, y, w2, mb.rh);
					vtx(c.cond, STYLE.forpart, b.cond, cx - w1, y + mb.rh, w1 + w2, mb.ch);

					var condMid = y + mb.rh + mb.ch / 2;
					var stepMid = y + mb.rh / 2;

					emitSeq(b.body, mb.body, b.id + ':body', cx + mb.bx, y + mb.bodyTop,
						{id: c.cond, cx: 1, cy: 0.5, x: cx + w2, y: condMid},
						{id: c.step, cx: 1, cy: 0.5, x: cx + w2, y: stepMid}, 'loop', cx + mb.loopX);

					return {
						entry: {id: c.init, cx: 1, cy: 0, x: cx, y: y},
						exit: {id: c.cond, cx: Math.round(w1 / (w1 + w2) * 1000) / 1000, cy: 1,
							x: cx, y: y + mb.boxH, bottom: y + mb.H}
					};
				}
			}

			// Bir diziyi eksen ax üzerinde yerleştirir. head: dizinin önündeki
			// bağlantı noktası, tail: dizinin bittiği yer.
			function emitSeq(seq, ms, key, ax, yTop, head, tail, mode, loopX)
			{
				var prev = head;
				var isHead = true;
				var yc = yTop;

				for (var i = 0; i <= seq.length; i++)
				{
					var last = (i === seq.length);
					var r = last ? null : emitBlock(seq[i], ms.items[i], ax, yc);
					var trg = last ? tail : r.entry;
					var src = prev;
					var pts = [];
					var arrow = true;

					if (last && mode === 'loop')
					{
						if (isHead)
						{
							pts = [{x: loopX, y: src.y}, {x: loopX, y: trg.y}];
						}
						else if (src.side != null)
						{
							src = src.side;
							pts = [{x: loopX, y: src.y}, {x: loopX, y: trg.y}];
						}
						else
						{
							var yb = src.bottom + 20;
							pts = [{x: src.x, y: yb}, {x: loopX, y: yb}, {x: loopX, y: trg.y}];
						}
					}
					else
					{
						if (src.x !== ax)
						{
							pts.push({x: ax, y: src.y});
						}

						if (last && mode === 'merge')
						{
							pts.push({x: ax, y: trg.y});
							arrow = false;
						}
					}

					slotEdge(key, i, src, trg, pts, arrow);

					if (!last)
					{
						prev = r.exit;
						isHead = false;
						yc += ms.items[i].H + GAP;
					}
				}

				return yc;
			}

			// START
			var sid = startId(m);
			var tid = stopId(m);
			vtx(sid, STYLE.start, 'START', X0 - 60, Y0, 120, 80);

			var ms = measureSeq(m, m.main);
			var yStop = Y0 + 80 + GAP + (ms.n > 0 ? ms.H + GAP : 0);

			emitSeq(m.main, ms, 'main', X0, Y0 + 80 + GAP,
				{id: sid, cx: 0.5, cy: 1, x: X0, y: Y0 + 80},
				{id: tid, cx: 0.5, cy: 0, x: X0, y: yStop}, 'main');

			vtx(tid, STYLE.stop, 'STOP', X0 - 60, yStop, 120, 80);

			return out;
		}

		// ------------------------------------------------------------------
		// Çizim: hücre tanımlarını modele uygular (var olanı günceller)
		// ------------------------------------------------------------------
		var rendering = false;

		function samePoints(a, b)
		{
			if ((a || []).length !== (b || []).length)
			{
				return false;
			}

			for (var i = 0; i < a.length; i++)
			{
				if (a[i].x !== b[i].x || a[i].y !== b[i].y)
				{
					return false;
				}
			}

			return true;
		}

		function render(m)
		{
			var specs = layout(m);
			var keep = {};
			var parent = null;

			// Var olan START hücresinin katmanını kullan
			var st = model.getCell(startId(m));
			parent = (st != null && model.getParent(st) != null) ? model.getParent(st) : graph.getDefaultParent();

			rendering = true;
			model.beginUpdate();

			try
			{
				// Önce düğümler, sonra kenarlar
				specs.sort(function (a, b)
				{
					return (a.edge ? 1 : 0) - (b.edge ? 1 : 0);
				});

				for (var i = 0; i < specs.length; i++)
				{
					var s = specs[i];
					var cell = model.getCell(s.id);
					keep[s.id] = true;

					if (s.edge)
					{
						var src = model.getCell(s.src);
						var trg = model.getCell(s.trg);
						var geo = new mxGeometry();
						geo.relative = true;
						geo.points = s.points.map(function (p)
						{
							return new mxPoint(p.x, p.y);
						});

						if (cell == null)
						{
							cell = new mxCell('', geo, s.style);
							cell.id = s.id;
							cell.setEdge(true);
							model.add(parent, cell);
						}
						else
						{
							if (cell.style !== s.style)
							{
								model.setStyle(cell, s.style);
							}

							var og = model.getGeometry(cell);

							if (og == null || !samePoints(og.points, geo.points))
							{
								var ng = (og != null) ? og.clone() : geo;
								ng.points = geo.points;
								model.setGeometry(cell, ng);
							}
						}

						if (model.getTerminal(cell, true) !== src)
						{
							model.setTerminal(cell, src, true);
						}

						if (model.getTerminal(cell, false) !== trg)
						{
							model.setTerminal(cell, trg, false);
						}
					}
					else
					{
						if (cell == null)
						{
							cell = new mxCell(s.value, new mxGeometry(s.x, s.y, s.w, s.h), s.style);
							cell.id = s.id;
							cell.setVertex(true);
							model.add(parent, cell);
						}
						else
						{
							if (cell.style !== s.style)
							{
								model.setStyle(cell, s.style);
							}

							var g = model.getGeometry(cell);

							if (g == null || g.x !== s.x || g.y !== s.y || g.width !== s.w || g.height !== s.h)
							{
								var g2 = (g != null) ? g.clone() : new mxGeometry();
								g2.x = s.x;
								g2.y = s.y;
								g2.width = s.w;
								g2.height = s.h;
								model.setGeometry(cell, g2);
							}
						}
					}
				}

				// Artık kullanılmayan drawalg hücrelerini sil
				var stale = [];

				for (var id in model.cells)
				{
					var c = model.cells[id];

					if (isDa(c) && !keep[id] && id.indexOf(PFX + m.uid + '-') === 0)
					{
						stale.push(c);
					}
				}

				for (var j = 0; j < stale.length; j++)
				{
					if (model.contains(stale[j]))
					{
						model.remove(stale[j]);
					}
				}

				writeModel(m);
			}
			finally
			{
				model.endUpdate();
				rendering = false;
			}
		}

		// ------------------------------------------------------------------
		// Sayfayı hazırla: boş sayfaya START/STOP ekle
		// ------------------------------------------------------------------
		function isPageEmpty()
		{
			var root = model.getRoot();

			if (root == null)
			{
				return false;
			}

			for (var i = 0; i < model.getChildCount(root); i++)
			{
				if (model.getChildCount(model.getChildAt(root, i)) > 0)
				{
					return false;
				}
			}

			return true;
		}

		function ensure()
		{
			if (ui.editor.isChromelessView() || !graph.isEnabled())
			{
				return;
			}

			var m = readModel();

			if (m == null)
			{
				if (!isPageEmpty())
				{
					return;
				}

				var file = (typeof ui.getCurrentFile === 'function') ? ui.getCurrentFile() : null;
				var wasModified = file != null && typeof file.isModified === 'function' && file.isModified();

				m = {v: 1, uid: newId(), main: []};
				render(m);

				// START/STOP eklemesi geri alınamasın
				ui.editor.undoManager.clear();

				// Otomatik eklenen START/STOP dosyayı "değişmiş" saymasın;
				// aksi halde boş bir pencereyi kapatırken kaydetme sorusu çıkar
				if (file != null && !wasModified && typeof file.setModified === 'function')
				{
					var unmodify = function ()
					{
						if (ui.getCurrentFile() === file && file.isModified())
						{
							file.setModified(false);

							if (typeof ui.clearStatus === 'function')
							{
								ui.clearStatus();
							}
						}
					};

					unmodify();
					setTimeout(unmodify, 0);
				}
			}
			else if (model.getCell(startId(m)) == null || model.getCell(stopId(m)) == null)
			{
				render(m);
			}
		}

		function ensureLater()
		{
			setTimeout(function ()
			{
				try
				{
					ensure();
				}
				catch (e)
				{
					if (window.console)
					{
						console.error('drawalg', e);
					}
				}
			}, 0);
		}

		ui.editor.addListener('fileLoaded', ensureLater);
		ui.editor.addListener('pageSelected', ensureLater);
		ensureLater();

		// ------------------------------------------------------------------
		// Ekleme
		// ------------------------------------------------------------------
		function styleValue(cell, key)
		{
			var st = cell.style || '';
			var m = new RegExp('(?:^|;)' + key + '=([^;]*)').exec(st);
			return m ? m[1] : null;
		}

		// Hedef hücreye göre ekleme konumu: {key, idx}
		function resolvePos(m, cell)
		{
			if (cell == null || !isDa(cell))
			{
				return null;
			}

			if (model.isEdge(cell))
			{
				var key = styleValue(cell, 'daSeq');
				var idx = parseInt(styleValue(cell, 'daIdx'), 10);

				if (key != null && !isNaN(idx) && seqByKey(m, key) != null)
				{
					return {key: key, idx: idx};
				}

				return null;
			}

			var info = cellMap(m)[cell.id];

			if (info == null)
			{
				return null;
			}

			if (info.start)
			{
				return {key: 'main', idx: 0};
			}

			if (info.stop)
			{
				return {key: 'main', idx: m.main.length};
			}

			var f = findBlock(m, info.block);

			return (f != null) ? {key: f.key, idx: f.idx + 1} : null;
		}

		function focusCellOf(m, b)
		{
			var c = ids(m, b);
			return model.getCell(c.main);
		}

		function insertBlock(type, target)
		{
			if (!graph.isEnabled())
			{
				return;
			}

			graph.stopEditing(false);
			ensure();

			var m = readModel();

			if (m == null)
			{
				ui.alert('Bu sayfa drawalg akışı içermiyor. Yeni boş bir sayfada (Sayfa ekle) START/STOP otomatik oluşur.');
				return;
			}

			var pos = resolvePos(m, target);

			if (pos == null && target == null)
			{
				pos = resolvePos(m, graph.getSelectionCell());
			}

			if (pos == null)
			{
				pos = {key: 'main', idx: m.main.length};
			}

			var b = newBlock(type);
			seqByKey(m, pos.key).splice(pos.idx, 0, b);
			render(m);

			var cell = focusCellOf(m, b);

			if (cell != null)
			{
				graph.setSelectionCell(cell);
				graph.scrollCellToVisible(cell);
			}
		}

		// ------------------------------------------------------------------
		// Silme, etiket düzenleme, bağlantı kilitleri
		// ------------------------------------------------------------------
		var graphDeleteCells = graph.deleteCells;

		graph.deleteCells = function (cells, includeEdges)
		{
			var m = readModel();

			if (m == null || cells == null)
			{
				return graphDeleteCells.apply(this, arguments);
			}

			var map = cellMap(m);
			var del = {};
			var rest = [];
			var after = null;

			for (var i = 0; i < cells.length; i++)
			{
				var info = map[cells[i].id];

				if (info != null && info.block != null)
				{
					del[info.block] = true;
				}
				else if (!isDa(cells[i]))
				{
					rest.push(cells[i]);
				}
			}

			var list = Object.keys(del);

			if (list.length === 0)
			{
				return graphDeleteCells.call(this, rest, includeEdges);
			}

			var select = null;
			model.beginUpdate();

			try
			{
				for (var j = 0; j < list.length; j++)
				{
					var f = findBlock(m, list[j]);

					if (f != null)
					{
						f.seq.splice(f.idx, 1);
						after = {key: f.key, idx: f.idx};
					}
				}

				render(m);

				if (rest.length > 0)
				{
					select = graphDeleteCells.call(this, rest, includeEdges);
				}
			}
			finally
			{
				model.endUpdate();
			}

			// Silinen adımın yerindeki oku seç (yeni ekleme oraya yapılır)
			if (after != null && seqByKey(m, after.key) != null)
			{
				var e = model.getCell(PFX + m.uid + '-e-' + after.key.replace(':', '-') + '-' + after.idx);

				if (e != null)
				{
					select = [e];
				}
			}

			return select;
		};

		var graphCellLabelChanged = graph.cellLabelChanged;

		graph.cellLabelChanged = function (cell, value, autoSize)
		{
			var m = (!rendering && isDa(cell)) ? readModel() : null;
			var info = (m != null) ? cellMap(m)[cell.id] : null;

			if (info == null || info.field == null)
			{
				return graphCellLabelChanged.apply(this, arguments);
			}

			model.beginUpdate();

			try
			{
				graphCellLabelChanged.apply(this, arguments);
				var f = findBlock(m, info.block);

				if (f != null)
				{
					f.block[info.field] = rawValue(cell);
				}

				render(m);
			}
			finally
			{
				model.endUpdate();
			}
		};

		var graphIsCellDisconnectable = graph.isCellDisconnectable;

		graph.isCellDisconnectable = function (cell)
		{
			if (isDa(cell))
			{
				return false;
			}

			return graphIsCellDisconnectable.apply(this, arguments);
		};

		// ------------------------------------------------------------------
		// Sürükle-bırak hedefi: imlece en yakın drawalg oku ya da şekli
		// ------------------------------------------------------------------
		function distToSeg(px, py, a, b)
		{
			var dx = b.x - a.x, dy = b.y - a.y;
			var len = dx * dx + dy * dy;
			var t = len > 0 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len)) : 0;
			var x = a.x + t * dx, y = a.y + t * dy;
			return Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
		}

		// x, y: ekran (görünüm) koordinatları
		function hitTest(x, y)
		{
			var best = null;
			var bd = 14;

			for (var id in model.cells)
			{
				var c = model.cells[id];

				if (!isDa(c))
				{
					continue;
				}

				var state = graph.view.getState(c);

				if (state == null)
				{
					continue;
				}

				if (model.isEdge(c))
				{
					var pts = state.absolutePoints || [];

					for (var i = 1; i < pts.length; i++)
					{
						if (pts[i - 1] != null && pts[i] != null)
						{
							var d = distToSeg(x, y, pts[i - 1], pts[i]);

							if (d < bd)
							{
								bd = d;
								best = c;
							}
						}
					}
				}
			}

			if (best != null)
			{
				return best;
			}

			for (var id2 in model.cells)
			{
				var v = model.cells[id2];

				if (isDa(v) && model.isVertex(v) && graph.isCellSelectable(v))
				{
					var s = graph.view.getState(v);

					if (s != null && mxUtils.contains(s, x, y))
					{
						return v;
					}
				}
			}

			return null;
		}

		// ------------------------------------------------------------------
		// Palet
		// ------------------------------------------------------------------
		var ICON = {
			tanimla: '<polygon points="10,8 46,8 38,32 2,32"/>',
			oku: '<polygon points="12,4 42,4 42,36 4,36 4,12"/>',
			islem: '<rect x="3" y="8" width="42" height="24"/>',
			yazdir: '<path d="M3 5 H45 V30 C36 22 26 40 14 33 C9 30 6 30 3 32 Z"/>',
			'if': '<polygon points="24,3 45,20 24,37 3,20"/>',
			'for': '<rect x="3" y="6" width="42" height="28"/><line x1="3" y1="20" x2="45" y2="20"/><line x1="24" y1="6" x2="24" y2="20"/>'
		};

		function createIcon(type)
		{
			var div = document.createElement('div');
			div.innerHTML = '<svg width="48" height="40" viewBox="0 0 48 40" style="overflow:visible">' +
				'<g fill="none" stroke="currentColor" stroke-width="1.3">' + ICON[type] + '</g></svg>';
			return div.firstChild;
		}

		function createDragPreview(type)
		{
			var b = newBlock(type);
			var m = {uid: 'x', main: [b]};
			var mb = measureBlock(m, b);
			var w = (type === 'if' || type === 'for') ? (type === 'for' ? 160 : mb.d.w) : mb.s.w;
			var h = (type === 'if') ? mb.d.h : ((type === 'for') ? 80 : mb.s.h);
			var prev = document.createElement('div');
			prev.style.border = '1px dashed #29b6f2';
			prev.style.width = w + 'px';
			prev.style.height = h + 'px';
			return prev;
		}

		function createItem(def)
		{
			var elt = document.createElement('a');
			elt.className = 'geItem drawalgItem';
			elt.setAttribute('title', def.title + ' — ' + def.hint);
			elt.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;justify-content:center;' +
				'width:66px;height:64px;margin:1px;padding:2px;box-sizing:border-box;cursor:pointer;overflow:hidden;' +
				'color:inherit;text-decoration:none;border-radius:4px;';
			elt.appendChild(createIcon(def.type));

			var cap = document.createElement('div');
			cap.style.cssText = 'font-size:10px;margin-top:2px;white-space:nowrap;';
			mxUtils.write(cap, def.title);
			elt.appendChild(cap);

			mxEvent.addListener(elt, 'click', function (evt)
			{
				insertBlock(def.type, null);
				mxEvent.consume(evt);
			});

			var ds = mxUtils.makeDraggable(elt, graph, function (g, evt, target, x, y)
			{
				// Bırakılan yerde ok/şekil yoksa sona eklenir
				insertBlock(def.type, target || 'none');
			}, createDragPreview(def.type), 0, 0, true, false, true, function (g, x, y)
			{
				return hitTest(x, y);
			});

			// Tıklamayı sürüklemeden ayır
			ds.isGuidesEnabled = function ()
			{
				return false;
			};

			return elt;
		}

		function buildPalette(div)
		{
			div.style.padding = '6px 4px 8px 4px';

			for (var i = 0; i < TYPES.length; i++)
			{
				div.appendChild(createItem(TYPES[i]));
			}

			var help = document.createElement('div');
			help.style.cssText = 'font-size:11px;line-height:1.45;opacity:0.75;padding:6px 4px 0 4px;white-space:normal;';
			help.innerHTML =
				'<b>Tıkla:</b> seçili şeklin altına ya da seçili oka ekler (seçim yoksa STOP\'tan önceye).<br>' +
				'<b>Sürükle:</b> bir okun üzerine bırak.<br>' +
				'<b>İF / FOR içine eklemek:</b> önce False/True ya da FOR gövdesi okunu seç.<br>' +
				'<b>Yazmak:</b> şekil seçiliyken yazmaya başla. <b>Silmek:</b> Delete.';
			div.appendChild(help);
		}

		function addPalette()
		{
			var sb = ui.sidebar;

			if (sb == null || sb.palettes == null || sb.palettes.drawalg != null)
			{
				return;
			}

			sb.addPalette('drawalg', 'Algoritma', true, function (content)
			{
				buildPalette(content);
			}, true);

			// Paleti en üste (arama kutusunun altına) taşı
			try
			{
				var p = sb.palettes.drawalg;
				var wrapper = p[0].parentNode;
				var ref = (sb.palettes.search != null && sb.palettes.search[1] != null &&
					sb.palettes.search[1].parentNode === wrapper) ?
					sb.palettes.search[1].nextSibling : wrapper.firstChild;

				if (ref != null && ref !== p[0])
				{
					wrapper.insertBefore(p[0], ref);
					wrapper.insertBefore(p[1], p[0].nextSibling);
				}
			}
			catch (e)
			{
				// yoksay
			}
		}

		// İlk çalıştırmada diğer şekil kütüphanelerini gizle
		// (sonradan "+ Diğer Şekiller" ile geri açılabilir)
		try
		{
			if (window.localStorage != null && localStorage.getItem('drawalg.librariesHidden') == null &&
				ui.sidebar != null && typeof ui.sidebar.showEntries === 'function')
			{
				ui.sidebar.showEntries('', true, true);
				localStorage.setItem('drawalg.librariesHidden', '1');
			}
		}
		catch (e)
		{
			// yoksay
		}

		addPalette();

		// Kenar çubuğu yeniden kurulursa paleti geri ekle
		if (ui.sidebar != null)
		{
			var sidebarInit = ui.sidebar.init;

			ui.sidebar.init = function ()
			{
				sidebarInit.apply(this, arguments);
				addPalette();
			};
		}

		// Test ve hata ayıklama için
		window.drawalg = {
			ui: ui,
			insert: function (type, target)
			{
				insertBlock(type, target);
			},
			model: readModel,
			render: function ()
			{
				var m = readModel();

				if (m != null)
				{
					render(m);
				}
			},
			ensure: ensure,
			ids: function (b)
			{
				return ids(readModel(), b);
			}
		};
	}
})();
