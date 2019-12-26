'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = require('fs');
var schema = _interopDefault(require('vega-lite/build/vega-lite-schema'));

function error(_) {
  throw new Error(_);
}

function isArray(_) {
  return Array.isArray(_);
}

function isObject(_) {
  return _ === Object(_);
}

function isString(_) {
  return typeof _ === 'string';
}

function hasOwnProperty(obj, property) {
  return Object.prototype.hasOwnProperty.call(obj, property);
}

function stringValue(_) {
  return Array.isArray(_) ? '[' + _.map(stringValue) + ']'
    : isObject(_) || isString(_) ?
      // Output valid JSON and JS source strings.
      // See http://timelessrepo.com/json-isnt-a-javascript-subset
      JSON.stringify(_).replace('\u2028','\\u2028').replace('\u2029', '\\u2029')
    : _;
}

function emitter(defaultFile) {
  const imports = {[defaultFile]: {}},
        lines = [];

  let prefix = '';

  const emit = (s) => {
    lines.push(s ? (prefix + s) : '');
    return emit;
  };

  emit.indent = () => {
    prefix = prefix + '  ';
    return emit;
  };

  emit.outdent = () => {
    prefix = prefix.slice(-2);
    return emit;
  };

  emit.import = (methods, file) => {
    file = file || defaultFile;
    (Array.isArray(methods) ? methods : [methods])
      .forEach(m => (imports[file] || (imports[file] = {}))[m] = 1);
    return emit;
  };

  emit.code = () => {
    const files = Object.keys(imports);

    const code = files.reduce((list, file) => {
      const methods = Object.keys(imports[file]).sort().join(', ');
      list.push(`import {${methods}} from './${file}';`);
      return list;
    }, []);

    return code.concat('', lines).join('\n');
  };

  return emit;
}

function article(_) {
  return _ && _.match(/^[aeiou]/) ? 'an' : 'a';
}

function capitalize(_) {
  return _[0].toUpperCase() + _.slice(1);
}

function uppercase(_) {
  return _.toUpperCase();
}

function code(_) {
  return `<code>${_}</code>`;
}

function link(_) {
  return `[${_}](${_})`;
}

function lookup(schema, ref) {
  if (!ref) return null;

  const path = ref.split('/');
  for (let i=1; i<path.length; ++i) {
    schema = schema[path[i]];
    if (schema == null) break;
  }
  return schema;
}

function search(schema, type, check, get, gather, base) {
  let t;
  return !type
      ? base()
    : type.$ref
      ? search(schema, lookup(schema, type.$ref), check, get, gather, base)
    : check(type)
      ? get(type)
    : (t = type.anyOf || type.allOf || type.oneOf)
      ? gather(t.map(_ => search(schema, _, check, get, gather, base)))
    : base();
}

function props(schema, type) {
  return search(schema, type,
    t => t.type === 'object',
    t => t.properties,
    a => Object.assign({}, ...a),
    () => null
  );
}

function enums(schema, type) {
  return search(schema, type,
    t => t.enum,
    t => t.enum,
    a => [].concat(...a).sort(),
    () => []
  );
}

function types(schema, type) {
  return search(schema, type,
    t => t.type === 'object' && (t = t.properties) && (t = t.type),
    t => t.properties.type.enum || [],
    a => [].concat(...a).sort(),
    () => []
  );
}

function isArrayType(schema) {
  if (schema.type === 'array') {
    return true;
  } else if (schema = (schema.anyOf || schema.oneOf)) {
    // if there are two matching types (one scalar, one array)
    let index, types = schema.map(s => s.type);
    return types.length === 2
      && (index = types.indexOf('array')) >= 0
      && types[1-index] === (schema[index].items || {}).type;
  } else {
    return false;
  }
}

function generateMethod(schema, methodName, spec) {
  const emit = emitter('__util__'),
        className = '_' + methodName,
        ext = spec.ext || {};

  if (spec.ctr) {
    // method is a proxied invocation of another method
    generateProxy(emit, methodName, spec, spec.ctr);
    return emit.code();
  }

  // -- constructor --
  generateConstructor(emit, className, spec);

  // -- prototype --
  emit.import('proto');
  emit('// eslint-disable-next-line no-unused-vars');
  emit(`const prototype = proto(${className});\n`);

  // -- properties --
  for (let prop in schema) {
    if (hasOwnProperty(ext, prop)) continue; // skip if extension defined
    const mod = isArrayType(schema[prop]) ? '...' : '';
    generateProperty(emit, prop, prop, mod);
  }

  // -- extensions --
  for (let prop in ext) {
    if (ext[prop] == null) continue; // skip if null
    generateExtension(emit, prop, ext[prop]);
  }

  // -- pass --
  for (let prop in spec.pass) {
    if (spec.pass[prop] == null) continue; // skip if null
    generatePass(emit, prop, spec.pass[prop]);
  }

  // -- call --
  for (let prop in spec.call) {
    if (spec.call[prop] == null) continue; // skip if null
    generateCall(emit, prop, spec.call[prop]);
  }

  // -- key --
  if (spec.key || spec.nest) {
    generateToJSON(emit, spec);
  }

  // -- exports --
  emit(`export function ${methodName}(...args) {`);
  emit(`  return new ${className}(...args);`);
  emit(`}`);

  return emit.code();
}

function generateProxy(emit, methodName, spec, opt) {
  const m = opt.call,
        a = opt.arg ? stringValue(opt.arg) + ', ' : '';

  emit.import(m, opt.from || m);
  emit(`export function ${methodName}(...args) {`);
  if (spec.set) {
    emit.import('set');
    const set = generateMutations('obj', spec.set);
    emit(`  const obj = ${m}(...args);`);
    set.forEach(v => emit('  ' + v));
    emit(`  return obj;`);
  } else {
    emit(`  return ${m}(${a}...args);`);
  }
  emit(`}`);
}

function generateConstructor(emit, className, spec) {
  const arg  = spec.arg,
        set  = spec.set,
        type = spec.type;

  emit(`function ${className}(...args) {`);

  // init data object
  emit.import('init');
  emit(`  init(this);`);

  // handle set values
  for (let prop in set) {
    emit.import('set');
    emit(`  set(this, ${stringValue(prop)}, ${stringValue(set[prop])});`);
  }

  // handle argument values
  if (Array.isArray(arg)) {
    // use provided argument definitions
    for (let i=0, n=arg.length; i<n; ++i) {
      const _ = arg[i],
            t = type && type[i];

      if (Array.isArray(_)) { // include a default value
        emit.import('set');
        emit(`  set(this, ${stringValue(_[0])}, args[${i}] !== undefined ? args[${i}] : ${_[1]});`);
      }
      else if (_.startsWith(':::')) { // merge object arguments
        if (i !== 0) error('Illegal argument definition.');
        emit.import(['get', 'set', 'merge']);
        if (t) emit(`  args = args.map(_ => ${typeSwitch(emit, t, '_')});`);
        emit(`  set(this, ${stringValue(_.slice(3))}, merge(0, get(this, ${stringValue(_.slice(3))}), args));`);
        break;
      }
      else if (_.startsWith('...')) { // array value from arguments
        if (i !== 0) error('Illegal argument definition.');
        emit.import(['set', 'flat']);
        if (t) {
          emit(`  args = flat(args).map(_ => ${typeSwitch(emit, t, '_')});`);
        } else {
          emit('  args = flat(args);');
        }
        emit(`  set(this, ${stringValue(_.slice(3))}, args);`);
        break;
      }
      else if (_.startsWith('^_')) { // internal state, autogenerate id
        emit.import('id');
        emit(`  this[${stringValue(_.slice(1))}] = args[${i}] !== undefined ? args[${i}] : id(${stringValue(_.slice(2))});`);
      }
      else if (_.startsWith('_')) { // internal state
        emit(`  if (args[${i}] !== undefined) this[${stringValue(_)}] = args[${i}];`);
      }
      else { // set value if not undefined
        emit.import('set');
        const v = t ? typeSwitch(emit, t, `args[${i}]`) : `args[${i}]`;
        emit(`  if (args[${i}] !== undefined) set(this, ${stringValue(_)}, ${v});`);
      }
    }
  } else {
    // otherwise, accept property value objects
    emit.import('assign');
    if (type) {
      emit(`  args = args.map(_ => ${typeSwitch(emit, type, '_')});`);
    }
    emit(`  assign(this, ...args);`);
  }

  emit(`}`);
  emit();
}

function generateExtension(emit, prop, val) {
  if (val.arg && val.arg.length > 1) {
    error('Extension method must take 0-1 named arguments');
  }

  const arg  = val.arg && val.arg[0],
        pre  = val.pre && val.pre[0],
        type = val.type && val.type[0],
        flag = val.flag || 0,
        set  = generateMutations('obj', val.set);

  !arg // zero-argument generator
      ? generateCopy(emit, prop, set)
    : arg.startsWith(':::') // merge object arguments
      ? generateMergedProperty(emit, prop, arg.slice(3), pre, type, flag, set)
    : arg.startsWith('+::') // merge object arguments and accrete object
      ? generateAccretiveObjectProperty(emit, prop, arg.slice(3), pre, type, flag, set)
    : arg.startsWith('+++') // merge object arguments and accrete array
      ? generateAccretiveArrayProperty(emit, prop, arg.slice(3), pre, type, flag, set)
    : arg.startsWith('...') // array value from arguments
      ? generateProperty(emit, prop, arg.slice(3), '...', type, set)
    : generateProperty(emit, prop, arg, '', type, set); // standard value argument
}

function generateMutations(obj, values) {
  let code = [];
  for (let prop in values) {
    code.push(`set(${obj}, ${stringValue(prop)}, ${stringValue(values[prop])});`);
  }
  return code;
}

function generateCopy(emit, method, set) {
  emit.import('copy');
  if (set) emit.import('set');

  emit(`prototype.${method} = function() {`);
  emit(`  const obj = copy(this);`);
  if (set) set.forEach(v => emit('  ' + v));
  emit(`  return obj;`);
  emit(`};`);
  emit();
}

function typeSwitch(emit, types, value) {
  let code = '';

  for (let key in types) {
    let _ = types[key],
        set, val, check;

    switch (key) {
      case 'array':   check = 'isArray';   break;
      case 'string':  check = 'isString';  break;
      case 'number':  check = 'isNumber';  break;
      case 'boolean': check = 'isBoolean'; break;
      case 'object':  check = 'isObject';  break;
    }
    emit.import(check);

    if (_.map) {
      val = typeSwitch(emit, _.map, '_');
      val = `${value}.map(_ => { return ${val}; })`;
    } else {
      key = _.key;
      set = _.set;
      val = [`${key}: ${_.map ? '_' : value}`];
      for (let k in set) val.push(`${k}: ${stringValue(set[k])}`);
      val = `{${val.join(', ')}}`;
    }

    code += `${check}(${value}) ? ${val} : `;
  }

  return code + value;
}

function generateProperty(emit, method, prop, mod, type, set) {
  emit.import(['copy', 'get', 'set']);
  if (mod) emit.import('flat');

  emit(`prototype.${method} = function(${mod || ''}value) {`);
  emit(`  if (arguments.length) {`);
  emit(`    const obj = copy(this);`);
  if (mod) {
    emit('    value = flat(value)'
      + (type ? `.map(v => ${typeSwitch(emit, type, 'v')});` : ';'));
  } else if (type) {
    emit(`    value = ${typeSwitch(emit, type, 'value')}`);
  }
  emit(`    set(obj, ${stringValue(prop)}, value);`);
  if (set) set.forEach(v => emit('    ' + v));
  emit(`    return obj;`);
  emit(`  } else {`);
  emit(`    return get(this, ${stringValue(prop)});`);
  emit(`  }`);
  emit(`};`);
  emit();
}

function generateMergedProperty(emit, method, prop, pre, type, flag, set) {
  emit.import(['copy', 'get', 'merge', 'set']);

  emit(`prototype.${method} = function(...values) {`).indent();

  if (!pre)
  emit(`if (arguments.length) {`).indent();
  else
  emit(  `values = [${stringValue(pre)}].concat(values)`);

  if (type)
  emit(  `values = values.map(v => ${typeSwitch(emit, type, 'v')});`);
  emit(  `const obj = copy(this);`);
  emit(  `set(obj, ${stringValue(prop)}, merge(${flag}, values));`);
  if (set) set.forEach(v => emit(v));
  emit(  `return obj;`);

  if (!pre) {
  emit.outdent();
  emit(`} else {`).indent();
  emit(  `return get(this, ${stringValue(prop)});`).outdent();
  emit(`}`); }

  emit.outdent();
  emit(`};`);
  emit();
}

function generateAccretiveObjectProperty(emit, method, prop, pre, type, flag, set) {
  emit.import(['copy', 'get', 'merge', 'set']);

  emit(`prototype.${method} = function(...values) {`).indent();

  if (!pre)
  emit(`if (arguments.length) {`).indent();
  else
  emit(  `values = [${stringValue(pre)}].concat(values)`);

  if (type)
  emit(  `values = values.map(v => ${typeSwitch(emit, type, 'v')});`);
  emit(  `const val = get(this, ${stringValue(prop)});`);
  emit(  `const obj = copy(this);`);
  emit(  `if (val) values = [val].concat(values);`);
  emit(  `set(obj, ${stringValue(prop)}, merge(${flag}, values));`);
  if (set) set.forEach(v => emit(v));
  emit(  `return obj;`);

  if (!pre) {
  emit.outdent();
  emit(`} else {`).indent();
  emit(  `return get(this, ${stringValue(prop)});`).outdent();
  emit(`}`); }

  emit.outdent();
  emit(`};`);
  emit();
}

function generateAccretiveArrayProperty(emit, method, prop, pre, type, flag, set) {
  emit.import(['copy', 'get', 'merge', 'set']);

  emit(`prototype.${method} = function(...values) {`).indent();

  if (!pre)
  emit(`if (arguments.length) {`).indent();
  else
  emit(  `values = [${stringValue(pre)}].concat(values)`);

  if (type)
  emit(  `values = values.map(v => ${typeSwitch(emit, type, 'v')});`);
  emit(  `const val = get(this, ${stringValue(prop)}) || [];`);
  emit(  `const obj = copy(this);`);
  emit(  `values = [].concat(val, merge(${flag}, values));`);
  emit(  `set(obj, ${stringValue(prop)}, values.length > 1 ? values : values[0]);`);
  if (set) set.forEach(v => emit(v));
  emit(  `return obj;`);

  if (!pre) {
  emit.outdent();
  emit(`} else {`).indent();
  emit(  `return get(this, ${stringValue(prop)});`).outdent();
  emit(`}`); }

  emit.outdent();
  emit(`};`);
  emit();
}

function generatePass(emit, method, opt) {
  emit.import(opt.call, opt.from || opt.call);
  if (!opt.self) emit.import('assign');

  emit(`prototype.${method} = function(...values) {`);
  if (opt.args) emit(`  values = values.slice(0, ${opt.args});`);
  if (opt.prop) {
    emit(`  let obj = ${opt.call}();`);
    opt.self
      ? emit(`  obj = obj.${opt.self}(this);`)
      : emit(`  obj = assign(obj, this);`);
    emit(`  return obj.${opt.prop}(...values);`);
  } else {
    emit(`  const obj = ${opt.call}(...values);`);
    opt.self
      ? emit(`  return obj.${opt.self}(this);`)
      : emit(`  return assign(obj, this);`);
  }
  emit(`};`);
  emit();
}

function generateCall(emit, method, opt) {
  emit.import(opt.call, opt.from || opt.call);

  emit(`prototype.${method} = function(...values) {`);
  if (opt.args) emit(`  values = values.slice(0, ${opt.args});`);
  emit(`  return ${opt.call}.apply(this, values);`);
  emit(`};`);
  emit();
}

function generateToJSON(emit, spec) {
  emit.import('proto');

  const {key, nest} = spec,
        flag = Array.isArray(key);

  let obj = flag
    ? `flag ? ${generateJSON(key[1])} : ${generateJSON(key[0])}`
    : generateJSON(key);

  if (nest) {
    emit.import('nest');
    obj = `nest(${obj}, ${stringValue(nest.keys)}, ${stringValue(nest.rest)})`;
  }

  emit(`prototype.toJSON = function(${flag ? 'flag' : ''}) {`);
  emit(`  return ${obj};`);
  emit(`};`);
  emit();
}

function generateJSON(key) {
  if (isObject(key)) {
    let c = [];
    for (let k in key) {
      let v = key[k];
      v = v.startsWith('_') ? `this[${stringValue(v)}]` : v;
      c.push(`${k}: ${v}`);
    }
    return `{${c.join(', ')}}`;
  } else if (isString(key)) {
    const k = key.startsWith('_') ? `[this[${stringValue(key)}]]` : key;
    return `{${k}: proto().toJSON.call(this)}`;
  } else {
    return `proto().toJSON.call(this)`;
  }
}

function write(name, data) {
  return new Promise(function(resolve, reject) {
    fs.writeFile(name, data, 'utf8', err => err ? reject(err) : resolve(data));
  });
}

function generateAPI(schema, api, path) {
  const q = [];

  // generate api method definitions
  for (let name in api) {
    if (name.startsWith('$')) continue; // skip external methods
    const def = props(schema, {$ref: '#/definitions/' + api[name].def});
    q.push(write(`${path}/${name}.js`, generateMethod(def, name, api[name])));
  }

  // generate api index
  q.push(write(`${path}/index.js`, generateIndex(api)));

  return Promise.all(q);
}

function generateIndex(api) {
  let code = '';
  for (let name in api) {
    if (name.startsWith('_')) {
      continue; // skip private methods
    } else if (name.startsWith('$')) {
      const base = api[name].name;
      code += `export {${base ? `${base} as ` : ''}${name.slice(1)}} from "./${api[name].src}";\n`;
    } else {
      code += `export {${name}} from "./${name}";\n`;
    }
  }
  return code;
}

function generateDoc(schema, api, path, prefix) {
  // build documentation page for each top-level method
  const jobs = Object.keys(api).map(key => {
    let name = key;
    if (key.startsWith('_')) {
      return; // skip private methods
    } else if (key.startsWith('$')) {
      name = key.slice(1);
    }
    const def = props(schema, {$ref: '#/definitions/' + api[key].def});
    return write(`${path}/${name}.md`, docMethod(name, api[key], def, prefix));
  });

  // build index of top-level methods
  jobs.push(write(`${path}/index.md`, docIndex(api, docIndexEntry, prefix)));

  return Promise.all(jobs);
}

function docIndex(api, generate, prefix) {
  // group into sections
  const sec = {};

  Object.keys(api).forEach(k => {
    const ref = api[k].doc;
    (sec[ref] || (sec[ref] = [])).push(k);
  });

  let code = '## Vega-Lite API Reference\n';

  Object.keys(sec).forEach(ref => {
    code += `\n### ${ref}\n\n`;

    sec[ref].forEach(name => {
      if (name.startsWith('_')) ; else if (name.startsWith('$')) {
        code += generate(name.slice(1), api[name], prefix);
      } else {
        code += generate(name, api[name], prefix);
      }
    });
  });

  return code;
}

function docIndexEntry(name, spec, prefix) {
  return `- <a href="${name}">${prefix || ''}<b>${name}</b></a> - ${spec.desc || ''}\n`;
}

function docMethod(name, spec, schema, prefix) {
  let code = docMethodEntry(name, spec, prefix);

  if (spec.ctr) {
    const call = spec.ctr.call;
    code += `Returns a ${link(call)} instance.\n`;
    return code;
  }

  code += '\n';

  const props = collectProperties(spec, schema);

  if (!props.length) {
    // no properties, exit early
    return code;
  }

  // -- METHOD INDEX ----
  code += `## <code>${name}</code> Method Overview\n\n`;

  props.forEach(p => {
    let [prop] = p;
    code += `* <a href="#${prop}">${prop}</a>\n`;
  });

  code += '\n';

  // -- METHOD REFERENCE --
  code += `## <code>${name}</code> API Reference\n\n`;

  props.forEach(p => {
    let [prop, def] = p;

    let args = def ? docArguments(def.arg)
      : (isArrayType(schema[prop]) ? '...' : '') + 'value';

    code += `<a id="${prop}" href="#${prop}">#</a>
<em>${name}</em>.<b>${prop}</b>(<em>${args}</em>)\n`;

    const desc = docDescription(prop, schema, def);
    if (desc) code += '\n' + desc + '\n';
    code += '\n';
  });

  return code;
}

function collectProperties(spec, schema) {
  const ext = spec.ext || {},
        props = [];

  let prop;

  for (prop in ext) {
    if (ext[prop] != null) props.push([prop, ext[prop]]);
  }
  for (prop in spec.pass) {
    if (spec.pass[prop] != null) props.push([prop, spec.pass[prop]]);
  }
  for (prop in spec.call) {
    if (spec.call[prop] != null) props.push([prop, spec.call[prop]]);
  }
  for (prop in schema) {
    if (hasOwnProperty(ext, prop)) continue; // skip if extension defined
    props.push([prop]);
  }

  props.sort((a, b) => {
    const u = a[0], v = b[0];
    return u < v ? -1 : u > v ? 1 : 0;
  });

  return props;
}

function docMethodEntry(name, spec, prefix) {
  let desc = `${prefix || ''}<b>${name}</b>(<em>${docArguments(spec.arg)}</em>)
${spec.desc ? '\n' + spec.desc : ''}`;

  if (spec.type) {
    desc += '\n' + docTypeSwitch(null, spec.type);
  }

  return desc + '\n';
}

function docArguments(args) {
  return args ? args.map(docArgPrefix).join(', ') : '...values';
}

function docArgPrefix(arg) {
  if (arg == null) return '';
  if (Array.isArray(arg)) arg = arg[0];
  if (arg.startsWith('^')) arg = arg.slice(1);
  if (arg.startsWith('_')) arg = arg.slice(1);

  return arg.startsWith('...')
      || arg.startsWith(':::')
      || arg.startsWith('+::')
      || arg.startsWith('+++') ? '...' + arg.slice(3) : arg;
}

function docDescription(prop, schema, spec) {
  let desc = (spec && spec.desc)
    || (schema && schema[prop] && schema[prop].description);

  if (spec && spec.type) {
    desc += '\n' + docTypeSwitch(prop, spec.type);
  }

  return desc;
}

function docTypeSwitch(prop, types) {
  let desc = '\nThe behavior of this method depends on the argument type:\n\n';

  docCollectTypes(types).forEach(t => {
    desc += `- If the argument is ${article(t.type)} ${code(t.type + (t.array ? ' array' : ''))}, sets the ${code((prop ? prop + '.' : '') + t.key)} property.\n`;
  });

  desc += prop
    ? `- Otherwise, sets the ${code(prop)} property.`
    : `- Otherwise, sets the properties defined on the input argument(s), if provided.`;

  return desc;
}

function docCollectTypes(types) {
  const out = [];

  // isolate type mapping object
  types = isArray(types) ? types[0] : types;

  // collect type entries, recurse for mapped arrays
  for (let t in types) {
    if (types[t].key) {
      out.push({type: t, key: types[t].key});
    } else if (types[t].map) {
      const map = types[t].map;
      for (let m in map) {
        out.push({type: m, array: true, key: map[m].key});
      }
    }
  }

  // sort type-parameterized entries
  out.sort((a, b) => a.array ^ b.array ? -1 + 2 * +a.array
      : a.type < b.type ? -1 : a.type > b.type ? 1 : 0);

  return out;
}

const aggregateOps = {
  count: ['count'],
  valid: ['valid', 'field'],
  missing: ['missing', 'field'],
  distinct: ['distinct', 'field'],
  sum: ['sum', 'field'],
  mean: ['mean', 'field'],
  average: ['average', 'field'],
  variance: ['variance', 'field'],
  variancep: ['variancep', 'field'],
  stdev: ['stdev', 'field'],
  stdevp: ['stdevp', 'field'],
  stderr: ['stderr', 'field'],
  median: ['median', 'field'],
  q1: ['q1', 'field'],
  q3: ['q3', 'field'],
  ci0: ['ci0', 'field'],
  ci1: ['ci1', 'field'],
  min: ['min', 'field'],
  max: ['max', 'field'],
  argmin: ['argmin', 'field'],
  argmax: ['argmax', 'field']
};

const windowOps = {
  row_number: ['row_number'],
  rank: ['rank'],
  dense_rank: ['dense_rank'],
  percent_rank: ['percent_rank'],
  cume_dist: ['cume_dist'],
  ntile: ['ntile', 'param'],
  lag: ['lag', 'field', 'param'],
  lead: ['lead', 'field', 'param'],
  first_value: ['first_value', 'field'],
  last_value: ['last_Value', 'field'],
  nth_value: ['nth_value', 'field', 'param']
};

const timeUnitOps = {
  // local time
  year: ['year'],
  quarter: ['quarter'],
  month: ['month'],
  day: ['day'],
  date: ['date'],
  hours: ['hours'],
  minutes: ['minutes'],
  seconds: ['seconds'],
  milliseconds: ['milliseconds'],
  yearmonth: ['yearmonth'],
  timeYQ: ['yearquarter'],
  timeYQM: ['yearquartermonth'],
  timeYM: ['yearmonth'],
  timeYMD: ['yearmonthdate'],
  timeYMDH: ['yearmonthdatehours'],
  timeYMDHM: ['yearmonthdatehoursminutes'],
  timeYMDHMS: ['yearmonthdatehoursminutesseconds'],
  timeQM: ['quartermonth'],
  timeMD: ['monthdate'],
  timeMDH: ['monthdatehours'],
  timeHM: ['hoursminutes'],
  timeHMS: ['hoursminutesseconds'],
  timeMS: ['minutesseconds'],
  timeSMS: ['secondsmilliseconds'],

  // utc time
  utcyear: ['utcyear'],
  utcquarter: ['utcquarter'],
  utcmonth: ['utcmonth'],
  utcday: ['utcday'],
  utcdate: ['utcdate'],
  utchours: ['utchours'],
  utcminutes: ['utcminutes'],
  utcseconds: ['utcseconds'],
  utcmilliseconds: ['utcmilliseconds'],
  utcyearmonth: ['utcyearmonth'],
  utcYQ: ['utcyearquarter'],
  utcYQM: ['utcyearquartermonth'],
  utcYM: ['utcyearmonth'],
  utcYMD: ['utcyearmonthdate'],
  utcYMDH: ['utcyearmonthdatehours'],
  utcYMDHM: ['utcyearmonthdatehoursminutes'],
  utcYMDHMS: ['utcyearmonthdatehoursminutesseconds'],
  utcQM: ['utcquartermonth'],
  utcMD: ['utcmonthdate'],
  utcMDH: ['utcmonthdatehours'],
  utcHM: ['utchoursminutes'],
  utcHMS: ['utchoursminutesseconds'],
  utcMS: ['utcminutesseconds'],
  utcSMS: ['utcsecondsmilliseconds']
};

const N = 'nominal';
const O = 'ordinal';
const Q = 'quantitative';
const T = 'temporal';

const extLogic = {
  equals:  {arg: ['equal'], desc: 'Logical equals (==) comparison.'},
  gte:     {arg: ['gte'], desc: 'Logical greater than or equal to (>=) comparison.'},
  gt:      {arg: ['gt'], desc: 'Logical greater than (>) comparison.'},
  lte:     {arg: ['lte'], desc: 'Logical less than or equal to (<=) comparison.'},
  lt:      {arg: ['lt'], desc: 'Logical less than (<) comparison.'},
  oneOf:   {arg: ['...oneOf'], desc: 'Logical set membership test.'},
  inRange: {arg: ['...range'], desc: 'Logical value in range test.'},
  valid:   {arg: ['valid'], desc: 'Logical valid value test.'}
};

// -- Transforms --

const desc = {
  aggregate: 'Group and summarize data as counts, sums, averages, etc.',
  bin: 'Discretize numeric values into uniform bins.',
  calculate: 'Calculate a new data field value.',
  filter: 'Remove data that does not match provided conditions.',
  flatten: 'Map array fields to new records, one per array entry.',
  fold: 'Collapse one or more data fields into two key, value fields.',
  impute: 'Fill in missing values with imputed values.',
  joinaggregate: 'Extend input data with aggregate values as new fields.',
  join: 'A convenient shorthand for joinaggregate.',
  lookup: 'Extend input data with values from another data source.',
  sample: 'Filter random records from the data limit its size.',
  stack: 'Compute running sums to stack groups of values.',
  timeUnit: 'Discretize date/time values into meaningful intervals.',
  window: 'Perform running calculations over sorted groups.',
  groupby: 'Group by fields for aggregate or window transforms.'
};

function transform(name, def, ...args) {
  return {
    desc: desc[name],
    doc:  'Data Transformations',
    def:  def,
    arg:  args
  };
}

function groupby() {
  return {
    desc: desc.groupby,
    doc:  'Data Transformations',
    arg:  ['...groupby'],
    pass: {
      aggregate:     {call: 'aggregate', desc: `Specify and return an ${link('aggregate')} transform.`},
      join:          {call: 'joinaggregate', desc: `Specify and return a ${link('joinaggregate')} transform.`},
      joinaggregate: {call: 'joinaggregate', desc: `Specify and return a ${link('joinaggregate')} transform.`},
      window:        {call: 'window', desc: `Specify and return a ${link('window')} transform.`}
    }
  };
}

// -- Transform Operators --

function aggregateOp(op, ...args) {
  return {
    desc: `Specify ${article(op)} ${code(op)} aggregate operation.`,
    doc:  'Aggregate Operations',
    def:  'AggregatedFieldDef',
    set:  {op: op},
    arg:  args,
    ext:  {
      order: { // for sorting
        arg: ['order'],
        desc: 'Indicates the sort order. One of `"ascending"` or `"descending"`. Only applicable if the operation is being used as a sort parameter.'
      }
    }
  };
}

function windowOp(op, ...args) {
  return {
    desc: `A ${code(op)} window operation.`,
    doc:  'Window Operations',
    def:  'WindowFieldDef',
    set:  {op: op},
    arg:  args
  };
}

function timeUnitOp(op, ...args) {
  return {
    desc: `A time unit operation for ${code(op)}.`,
    doc:  'TimeUnit Operations',
    def:  'TimeUnitTransform',
    set:  {timeUnit: op},
    arg:  args,
    ext:  extLogic
  };
}

// -- Logical Operations --

function field() {
  return {
    desc: 'A reference to a data field.',
    doc:  'References',
    arg:  ['field'],
    ext:  {
      order: {
        arg: ['order'],
        desc: 'Indicates the sort order. One of `"ascending"` or `"descending"`. Only applicable if the field is being used as a sort parameter.'
      },
      type:  {
        arg: ['type'],
        desc: 'The data type of the field. One of `"nominal"`, `"ordinal"`, `"quantitative"`, or `"temporal"`.'
      },
      ...extLogic
    }
  }
}

function fieldType(type) {
  return {
    desc: `A reference to ${article(type)} ${type} data field.`,
    doc:  'References',
    ctr:  {call: 'field'},
    set:  {type: type}
  }
}

function not() {
  return {
    desc: 'Logical NOT operation.',
    doc:  'Logical Operations',
    arg:  ['not']
  };
}

function logical(op) {
  return {
    desc: `Logical ${uppercase(op)} operation.`,
    doc:  'Logical Operations',
    arg:  [`...${op}`]
  };
}

// -- Selections --

function selection(type) {
  return {
    desc: `Define a new ${code(type)} selection.`,
    doc:  'Selections',
    def:  `${capitalize(type)}Selection`,
    set:  {type: type},
    arg:  ['^_sel'],
    key: [
      {selection: '_sel'},
      '_sel'
    ]
  };
}

function binding(def, input, args) {
  const set = input ? {input: input} : null;

  return {
    desc: `Define a new HTML ${code(input)} input element binding.`,
    doc:  'Selection Bindings',
    def:  def,
    set:  set,
    arg:  args
  };
}

// -- Encodings --

const channelAggregate = {};
for (let key in aggregateOps) {
  const _ = aggregateOps[key];
  channelAggregate[key] = {
    arg: [_[1]],
    set: {type: Q, aggregate: _[0]},
    desc: `Apply the ${code(_[0])} aggregate operation prior to encoding.`
  };
}

const channelTimeUnit = {};
for (let key in timeUnitOps) {
  const _ = timeUnitOps[key];
  channelTimeUnit[key] = {
    arg: ['field'],
    set: {type: T, timeUnit: _[0]},
    desc: `Apply the ${code(_[0])} timeUnit operation prior to encoding.`
  };
}

function channel(type) {
  const spec = {
    desc: `Specify the ${code(type)} encoding channel.`,
    doc:  'Encodings',
    def:  `FacetedEncoding/properties/${type}`,
    key:  [null, type],
    ext:  {
      fieldN: {arg: ['field'], set: {type: N}, desc: 'Encode the field as a nominal data type.'},
      fieldO: {arg: ['field'], set: {type: O}, desc: 'Encode the field as an ordinal data type.'},
      fieldQ: {arg: ['field'], set: {type: Q}, desc: 'Encode the field as a quantitative data type.'},
      fieldT: {arg: ['field'], set: {type: T}, desc: 'Encode the field as a temporal data type.'},
      if: {arg: ['+++condition'], flag: 0, desc: 'Perform a conditional encoding. If the provided condition (first argument) evaluates to true, apply the provided encoding (second argument).'},
      ...channelAggregate,
      ...channelTimeUnit
    }
  };

  const fieldN = {key: 'field', set: {type: N}},
        fieldO = {key: 'field', set: {type: O}},
        fieldQ = {key: 'field', set: {type: Q}};

  switch (type) {
    case 'detail':
    case 'tooltip':
      spec.type = {
        array:  {map: {string: fieldN}},
        string: fieldN
      };
      break;
    case 'href':
    case 'key':
    case 'shape':
    case 'text':
      spec.type = {string: fieldN};
      break;
    case 'column':
    case 'facet':
    case 'order':
    case 'row':
      spec.type = {string: fieldO};
      break;
    case 'latitude':
    case 'longitude':
    case 'latitude2':
    case 'longitude2':
      spec.type = {string: fieldQ};
      break;
  }

  return spec;
}

function encoding() {
  return {
    desc: 'A reference to an encoding channel.',
    doc:  'References',
    arg:  ['encoding'],
    ext: {
      order: {
        arg: ['encoding'],
        desc: 'Indicates a sort order for encoded values. One of `"ascending"` or `"descending"`.'
      }
    }
  };
}

function value() {
  return {
    desc: 'A constant encoding value.',
    doc:  'References',
    arg:  ['value']
  };
}

function repeat() {
  return {
    desc: 'A field variable reference for a repeated chart.',
    doc:  'References',
    def:  'RepeatRef',
    arg:  ['repeat']
  }
}

function projection() {
  return {
    desc: 'Define a cartographic projection for longitude, latitude coordinates.',
    doc:  'Projections',
    def:  'Projection',
    arg:  ['type']
  }
}

// -- Data Specification --

function data() {
  return {
    desc: 'Create a new data reference for a chart or lookup.',
    doc:  'Data',
    def:  'TopLevelUnitSpec',
    arg:  ['data'],
    type: typeData,
    ext:  extUnit,
    call: callSpec,
    pass: {
      fields:  {call: 'lookupData', prop: 'fields', desc: `Fields to retrieve in a ${link('lookupData')} reference.`},
      key:     {call: 'lookupData', prop: 'key', desc: `Key field to lookup in a ${link('lookupData')} reference.`},
      mark:    {call: 'mark', desc: `Create a new ${link('mark')} that visualizes this data reference.`},
      layer:   {call: 'layer', desc: `Create a ${link('layer')} chart that visualizes this data reference.`},
      hconcat: {call: 'hconcat', desc: `Create a ${link('hconcat')} chart that visualizes this data reference.`},
      vconcat: {call: 'vconcat', desc: `Create a ${link('vconcat')} chart that visualizes this data reference.`},
      ...passMulti
    }
  };
}

function source(type, args) {
  return {
    desc: `Define a ${type} data source.`,
    doc:  'Data',
    def:  `${capitalize(type)}Data`,
    arg:  args
  };
}

const formatDefs = {
  tsv: 'csv',
  topojson: 'topo'
};

function sourceFormat(type) {
  return {
    desc: `Define a data source for ${code(type)} format data.`,
    doc:  'Data',
    def:  `${capitalize(formatDefs[type] || type)}DataFormat`,
    type: {object: {key: 'values'}, ...typeData[0]},
    set:  {type: type},
    nest: {keys: ['url', 'values', 'name'], rest: 'format'},
    ext:  {
      url:    {arg: ['url'], desc: 'A URL from which to load the data.'},
      values: {arg: ['values'], desc: 'Provide loaded data values directly.'},
      name:   {arg: ['name'], desc: 'A name for this data source. Use this name to update the data via the runtime API.'}
    }
  };
}

function lookupData() {
  return {
    desc: `Specify a lookup on a secondary data source.`,
    doc:  'Data',
    def:  `LookupData`,
    arg:  ['data'],
    type: typeData,
  };
}

function format(type) {
  return {
    desc: `Specify parsing of ${code(type)} format data.`,
    doc:  'Data',
    def:  `${capitalize(formatDefs[type] || type)}DataFormat`,
    set:  {type: type}
  };
}

const generatorArgs = {
  sequence: ['start', 'stop', 'step']
};

function generator(type) {
  return {
    desc: `Define a ${code(type)} data generator.`,
    doc:  'Data',
    def:  `${capitalize(type)}Params`,
    key:  type,
    arg:  generatorArgs[type]
  };
}

// -- Top-Level Specifications --

const typeData = [
  {
    array:  {key: 'values'},
    string: {key: 'url'}
  }
];

const extSpec = {
  data:        {arg: ['data'], type: typeData, desc: `The input ${link('data')} specification.`},
  transform:   {arg: ['...transform'], desc: 'The data transformations to apply.'},
  $schema:     null // suppress!
};

const extLayer = {
  projection:  null,
  project:     {arg: ['projection'], desc: `The cartographic ${link('projection')} to apply to geographical data.`},
  ...extSpec
};

const extUnit = {
  mark:        {arg: [':::mark'], type: [{string: {key: 'type'}}], desc: 'Set the mark type and default visual properties.'},
  encoding:    null,
  encode:      {arg: ['+::encoding'], flag: 1, desc: 'Specify visual encodings for the mark.'},
  selection:   null,
  select:      {arg: ['+::selection'], flag: 1, desc: 'Register interactive selections on the mark.'},
  ...extLayer
};

const passMulti = {
  facet:   {call: '_facet',  args: 1, self: 'spec', desc: 'Facet a chart into sub-plots by partitioning data values.'},
  repeat:  {call: '_repeat', args: 1, self: 'spec', desc: 'Repeat a chart template to generate multiple plots.'}
};

const callSpec = {
  render:   {call: 'render', from: '__view__', desc: 'Compile and render the Vega-Lite visualization and return the DOM element containing the Vega View.'},
  toView:   {call: 'toView', from: '__view__', desc: 'Compile the Vega-Lite specification and return the resulting Vega View object.'},
  toSpec:   {call: 'toSpec', from: '__view__', desc: 'Return the Vega-Lite specification as a JavaScript object.'},
  toString: {call: 'toString', from: '__view__', desc: 'Return the Vega-Lite specification as a JSON string.'}
};

function unit(types) {
  const extMark = types.reduce((o, m) => {
    o[`mark${capitalize(m)}`] = {arg: [':::mark'], pre: [{type: m}]};
    return o;
  }, {});

  return {
    desc: `Create a new mark of unspecified type.`,
    doc:  'Chart Constructors',
    def:  'TopLevelUnitSpec',
    arg:  [':::mark'],
    type: [{string: {key: 'type'}}],
    ext:  {...extUnit, ...extMark},
    call: callSpec,
    pass: passMulti
  };
}

function mark(type) {
  return {
    desc: `Create a new ${code(type)} mark.`,
    doc:  'Chart Constructors',
    ctr:  {call: 'mark', arg: {type: type}}
  };
}

function layer(...args) {
  return {
    desc: 'Create a new layered chart.',
    doc:  'Chart Constructors',
    def:  'TopLevelLayerSpec',
    arg:  args,
    ext:  extLayer,
    call: callSpec,
    pass: passMulti
  };
}

function spec(verb, def, ...args) {
  return {
    desc: `${verb} charts.`,
    doc:  'Chart Constructors',
    def:  def,
    arg:  args,
    ext:  extSpec,
    call: callSpec,
    pass: {
      repeat: def === 'TopLevelRepeatSpec' ? undefined : passMulti.repeat
    }
  };
}

const markTypes = enums(schema, {$ref: '#/definitions/AnyMark'});
const dataFormats = types(schema, {$ref: '#/definitions/DataFormat'});

function apiOps(ops, method, ...params) {
  return Object.keys(ops)
    .reduce((api, o) => (api[o] = method(...ops[o], ...params), api), {});
}

function formats() {
  return dataFormats
    .reduce((api, f) => (api[`${f}Format`] = format(f), api), {});
}

function sources() {
  return dataFormats
    .reduce((api, f) => (api[`${f}`] = sourceFormat(f), api), {});
}

function generators() {
  const types = props(schema, {$ref: '#/definitions/Generator'});
  return Object.keys(types).filter(t => t !== 'name')
    .reduce((api, g) => (api[g] = generator(g), api), {});
}

function marks() {
  return markTypes
    .reduce((api, m) => (api[`mark${capitalize(m)}`] = mark(m), api), {});
}

function channels() {
  return Object.keys(props(schema, {$ref: '#/definitions/FacetedEncoding'}))
    .reduce((api, c) => (api[c] = channel(c), api), {});
}

function selections() {
  return types(schema, {$ref: '#/definitions/SelectionDef'})
    .reduce((api, t) => (api[`select${capitalize(t)}`] = selection(t), api), {});
}

const api = {
  // top-level specifications
  mark:     unit(markTypes),
  ...marks(),
  layer:    layer('...layer'),
  hconcat:  spec('Horizontally concatenate', 'TopLevelHConcatSpec', '...hconcat'),
  vconcat:  spec('Vertically concatenate', 'TopLevelVConcatSpec', '...vconcat'),
  _repeat:  spec('Repeat', 'TopLevelRepeatSpec', 'repeat', 'spec'),
  _facet:   spec('Facet', 'TopLevelFacetSpec', 'facet', 'spec'),

  // externally defined exports
  $register: {
    desc: 'Register Vega and Vega-Lite with the API.',
    doc:  'Utilities',
    arg:  ['vega', 'vegalite', 'options'],
    src:  '__view__'
  },
  $vega: {
    desc: 'Access the registered Vega instance.',
    doc:  'Utilities',
    src:  '__view__',
    name: '_vega'
  },
  $vegalite: {
    desc: 'Access the registered Vega-Lite instance.',
    doc:  'Utilities',
    src:  '__view__',
    name: '_vegalite'
  },

  // data specification
  data: data(),
  url: source('url', ['url']),
  values: source('inline', ['values']),
  ...generators(),
  ...sources(),
  ...formats(),
  lookupData: lookupData(),

  // encoding channels
  ...channels(),
  field:    field(),
  fieldN:   fieldType('nominal'),
  fieldO:   fieldType('ordinal'),
  fieldQ:   fieldType('quantitative'),
  fieldT:   fieldType('temporal'),
  encoding: encoding(),
  repeat:   repeat(),
  value:    value(),

  // cartographic projection
  projection: projection(),

  // selections
  ...selections(),

  // bindings
  checkbox:  binding('BindCheckbox', 'checkbox'),
  menu:      binding('BindRadioSelect', 'select', ['...options']),
  radio:     binding('BindRadioSelect', 'radio', ['...options']),
  slider:    binding('BindRange', 'range', ['min', 'max', 'step']),

  // logical operations
  not: not(),
  and: logical('and'),
  or:  logical('or'),

  // tranforms
  aggregate:     transform('aggregate', 'AggregateTransform', '...aggregate'),
  bin:           transform('bin', 'BinTransform', 'field', ['bin', true]),
  calculate:     transform('calculate', 'CalculateTransform', 'calculate'),
  filter:        transform('filter', 'FilterTransform', 'filter'),
  flatten:       transform('flatten', 'FlattenTransform', '...flatten'),
  fold:          transform('fold', 'FoldTransform', '...fold'),
  impute:        transform('impute', 'ImputeTransform', 'impute', 'key'),
  joinaggregate: transform('joinaggregate', 'JoinAggregateTransform', '...joinaggregate'),
  join:          transform('join', 'JoinAggregateTransform', '...joinaggregate'),
  lookup:        transform('lookup', 'LookupTransform', 'lookup'),
  sample:        transform('sample', 'SampleTransform', 'sample'),
  stack:         transform('stack', 'StackTransform', 'stack'),
  timeUnit:      transform('timeUnit', 'TimeUnitTransform', 'timeUnit', 'field'),
  window:        transform('window', 'WindowTransform', '...window'),
  groupby:       groupby(),

  // operations
  ...apiOps(aggregateOps, aggregateOp, 'as'),
  ...apiOps(windowOps, windowOp, 'as'),
  ...apiOps(timeUnitOps, timeUnitOp, 'field', 'as')
};

function build() {
  return Promise.all([
    generateAPI(schema, api, 'src'),
    generateDoc(schema, api, 'docs/api', 'vl.')
  ]);
}

exports.build = build;
