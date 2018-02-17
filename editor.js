var KerasModelViewer = require('./viewer.js');
var dat = require('dat.gui/build/dat.gui.js');
// If we use another SVG instance, textflow does not work!
var SVG = require('svg.js');
require('./lib/svg.textflow.js');
require('./index.css');

(function (root, factory) {

	/* CommonJS */
  if (typeof exports == 'object') {
    module.exports = root.document ? factory(root, root.document) : function(w){ return factory(w, w.document) }
  }

  /* AMD module */
  else if (typeof define == 'function' && define.amd) {
    define(function(){
      return factory(root, root.document)
    })
  }

  /* Global */
  else {
    root.KerasModelViewer = factory(root, root.document)
  }

}(typeof window !== "undefined" ? window : this, function (window, document) {


  var KerasModelEditor = window.KerasModelEditor = function(json, el, options) {
    if(!json) {
        console.log('KerasModelEditor: No Model provided.');
    }

    let self = this;
    this.viewer = new KerasModelViewer(json, el, options);

    if(this.viewer._options.keras_ver == 1) {
      var KerasModelConf = require('./lib/keras_conf_v1.js');
    }
    else {
      console.log('Only Keras v.1 models are supported');
      return;
    }
    this.keras_conf = KerasModelConf.keras_conf;
    this.keras_choices = KerasModelConf.keras_choices;
    this.keras_help = KerasModelConf.keras_help;

    let _draw_node = this.viewer.draw_node;
    this.viewer.draw_node = function(svgd, node, j) {
      let drawn = _draw_node.apply(self.viewer, [svgd, node, j]);
      return self.draw_node(drawn, svgd, node, j);
    }

    this.helping = false;
    this.help_pos = {x: 730, y:30};
    this.layer_editing = false;
  }

  KerasModelEditor.prototype.hide_dialog = function() {
    document.getElementById('json_source_editor').setAttribute('style', 'display: none;');
  }

  KerasModelEditor.prototype.save_src =function() {
    document.getElementById('json_source_editor').setAttribute('style', 'display: none;');
    let source = JSON.parse(document.getElementById('json_source_textarea').value);

    if (this.layer_editing && this.viewer.layer_ndx != "model"){
      if(this.viewer.json.config.layers) {
        this.viewer.json.config.layers[this.viewer.layer_ndx]=source;
      }
      else {
        this.viewer.json.config[this.viewer.layer_ndx]=source;
      }

      this.layer_editing = false
    } else {
      this.viewer.json = source
    }

    document.getElementById("json_source_textarea").blur();
    this.viewer.model()
  }

  KerasModelEditor.prototype.toggle_help = function(layeri) {
    let self = this;
    if (this.helping) {this.help.remove(); this.helping = false; return;}
    this.helping = true
    this.help = this.staticv.group()
    let dims = {w: 800, h: 800}
    this.help.rect(dims.w,dims.h).move(this.help_pos.x,this.help_pos.y).attr({rx:20, ry:20, "fill-opacity":.7, fill:"#fff", "stroke-width":1})

    var key = this.viewer.source_layers[this.viewer.layer_ndx].class_name

    let flow = this.help.textflow(key+": "+ this.viewer.keras_args[key].help, dims.w - 50,dims.h - 50)
        .font({ family: 'sans-serif',  size: 16, anchor: 'start' })
        .move(this.help_pos.x+25, this.help_pos.y +25)
        .fill('#000')
    let inc=0, text=""
    for (let i in this.viewer.keras_args[key].args){
      inc++
      text = text + "\n "+i+": "+self.keras_help[i];
    }

    flow = this.help.textflow(text, dims.w - 50,dims.h - 50)
        .font({ family: 'sans-serif',  size: 16, anchor: 'start' })
        .move(this.help_pos.x+25, this.help_pos.y + 125)
        .fill('#000')

    /*this.help.draggable().on('dragstart', function(e){
      drag_pos = {x: e.detail.p.x, y:e.detail.p.y}
    })

    this.help.draggable().on('dragend', function(e){
      self.help_pos = {x: self.help_pos.x + (e.detail.p.x-drag_pos.x), y: self.help_pos.y + (e.detail.p.y-drag_pos.y)}
    })*/
  }

  KerasModelEditor.prototype.update_layer = function(layer_index) {
    let self = this;
    let model = this.viewer.graph;

    model.layer[this.viewer.layer_ndx].attr({ "stroke-width":0.5})
    model.layer[layer_index].attr({ "stroke-width":2})

    let layer_ndx = this.viewer.layer_ndx = layer_index
    let source_layers = this.viewer.source_layers

    if (this.gui) this.gui.destroy()
    var classs = source_layers[layer_ndx].class_name

    //console.log(classs)
    var text = new show_menu(this.viewer, this, classs);
    this.gui = new dat.GUI();
    this.gui.add(text, "name");

    if (layer_ndx != "model") {
      var layerall_ctrl = this.gui.add(text, 'Layer', this.keras_conf.class_name );
      layerall_ctrl.onFinishChange(function(value) {
          // Fires when a controller loses focus.
          var old_name = source_layers[layer_ndx].config.name || source_layers[layer_ndx].name || source_layers[layer_ndx].class_name;
          self.change_name(layer_ndx, old_name, value+"_"+(source_layers.length))

          source_layers[layer_ndx] = {
              "class_name": value,
              name: value+"_"+(source_layers.length),
              "trainable": true,
              "config": self.viewer.keras_args[value].args,
            //  "name": value+"_"+(source_layers.length)
          }
          if(source_layers[layer_ndx].inbound_nodes) {
              source_layers[layer_ndx].inbound_nodes = source_layers[layer_ndx].inbound_nodes? source_layers[layer_ndx].inbound_nodes : []
          }
          source_layers[layer_ndx].config.name = value+"_"+(source_layers.length)

          //console.log(layer_ndx, source_layers, source_layers[layer_ndx])
          //return

          self.viewer.model();

        });

        if (text.trainable) this.gui.add(text, "trainable");
    }


    var control

    for (let i in this.viewer.keras_args[classs].args){
      if (this.keras_choices[i]) {
        control = this.gui.add(text, i, this.keras_choices[i]);
      } else {
        control = this.gui.add(text, i)
      }
      control.onFinishChange(function(value) {
          if(!value) {
              delete source_layers[layer_ndx].config[i];
          }
          else {
              // Fires when a controller loses focus.
              source_layers[layer_ndx].config[i] = value
          }
      });
    }


    this.gui.add(text, "Edit Source");
    this.gui.add(text, "Toggle Help");
  }

  KerasModelEditor.prototype.show_source = function(source) {
    document.getElementById('json_source_editor').setAttribute('style', 'display: block;');
    document.getElementById('json_source_textarea').value = JSON.stringify(source, null, ' ');
  }

  KerasModelEditor.prototype.change_name = function(ndx, old_name, name) {
    let self = this;
    this.viewer.source_layers.forEach(function(item,i){
      if (item.inbound_nodes) self.change_name_array(item.inbound_nodes, old_name, name)
    })
  }

  KerasModelEditor.prototype.change_name_array = function(arr, old_name, new_name) {
    let self = this;
    arr.forEach(function(item, i){
      if (item == old_name) { arr[i]=new_name;
      } else {
        if (typeof item == "object") self.change_name_array(item, old_name, new_name)
      }
    })

  }

  KerasModelEditor.prototype.add_layer_below = function(ndx) {
    let source_layers = this.viewer.source_layers;
    var new_layer = {
      "class_name": "Dense",
      "trainable": true,
      "config": {
          "b_constraint": null,
          "bias": true,
          "init": "uniform",
          "output_dim": null,
          "input_dim": null,
          "W_regularizer": null,
          "activity_regularizer": null,
          "W_constraint": null,
          "trainable": true,
          "name": "dense_"+(source_layers.length),
          "b_regularizer": null,
          "activation": "tanh"
      },
      "name": "dense_"+(source_layers.length)
    }
    if(this.viewer.json.config.layers) {
        new_layer.inbound_nodes = [
            [
                [
                    source_layers[ndx].config.name || source_layers[ndx].class_name,
                    0,
                    0
                ]
            ]
        ]
    }
    //console.log('add_layer_below', source_layers)
    source_layers.splice(ndx+1,0,new_layer);

    if(source_layers[ndx+2] && source_layers[ndx+2].inbound_nodes) {
        source_layers[ndx+2].inbound_nodes = [
                [
                    [
                        source_layers[ndx+1].config.name || source_layers[ndx+1].class_name,
                        0,
                        0
                    ]
                ]
           ];
    }
    this.viewer.layer_ndx = ndx;
    this.viewer.model();
  }

  KerasModelEditor.prototype.add_layer = function(ndx) {
    let source_layers = this.viewer.source_layers;
    var new_layer = {
        "class_name": "Dense",
        "trainable": true,
        "config": {
            "b_constraint": null,
            "bias": true,
            "init": "uniform",
            "output_dim": null,
            "input_dim": null,
            "W_regularizer": null,
            "activity_regularizer": null,
            "W_constraint": null,
            "trainable": true,
            "name": "dense_"+(source_layers.length),
            "b_regularizer": null,
            "activation": "tanh"
        },
        "name": "dense_"+(source_layers.length),
        "inbound_nodes": [
            [
                [
                    source_layers[ndx].config.name,
                    0,
                    0
                ]
            ]
        ]
    }
    source_layers.push(new_layer);
    this.viewer.layer_ndx = ndx;
    this.viewer.model();
  }

  KerasModelEditor.prototype.draw_node = function(drawn, svgd, node, j) {//function(svgd, node, j) {
    let group = drawn;
    let self = this;
    group.click(function() {
      self.update_layer(this.attr("data-index"))
    });
    var add = group.group()
    add.circle(25).attr({fill:"#fff","stroke-width": 2})
    var arrow = add.path("m5,10.6446 l3.57256,4.51989l3.57256,4.51989l3.57256,-4.51989l3.57256,-4.51989l-4.96673,0l0,-7.32094l-4.35678,0l0,7.32094l-4.96673,0z")
    if (this.viewer._options.rankdir == "LR") arrow.rotate(-90)
    add.cx(node.x + node.width/2).cy(node.y+node.height/2).attr("data-index",j-1)
    add.click(function() {
      self.add_layer(this.attr("data-index"))
    });
    var addL = group.group()
    addL.circle(25).attr({fill:"#fff","stroke-width": 2})
    var arrow2 = addL.path("m5,10.6446 l3.57256,4.51989l3.57256,4.51989l3.57256,-4.51989l3.57256,-4.51989l-4.96673,0l0,-7.32094l-4.35678,0l0,7.32094l-4.96673,0z")
    if (this.viewer._options.rankdir == "LR") {
      arrow2.rotate(-90)
      addL.cx(node.x + node.width/2).cy(node.y)
    }
    if (this.viewer._options.rankdir == "UD") {
      addL.cx(node.x).cy(node.y+node.height/2)
    }
    addL.attr("data-index",j-1)
    addL.click(function() {
      self.add_layer_below(this.attr("data-index"))
    })

    return group
  }

  KerasModelEditor.prototype.draw_btns = function() {
    let self = this;
    /*let el2 = document.createElement('div');
    el2.setAttribute('id', 'editorButtons');
    this.viewer._el.parentElement.appendChild(el2);
    this.drawBtns = SVG('editorButtons');
    console.log(this.drawBtns)
    this.staticv = this.drawBtns.group();*/
    this.source_btn = draw_btn(this.staticv, "m20.55053,17.80402l-11.206,11.20988l11.2073,11.20859l4.07609,-4.07609l-7.1325,-7.1325l7.13121,-7.13121l-4.07609,-4.07867m16.4014,0l-4.0735,4.07738l7.13121,7.13121l-7.13121,7.13121l4.0735,4.07609l11.20859,-11.20859l-11.20859,-11.2073");
    this.source_btn.click(function(){
        self.show_source(self.viewer.json)
    }).attr('style', 'cursor: pointer');

    this.dir_btn = draw_btn(this.staticv, "m14.11023,34.4384l4.17224,5.27878l4.17224,5.27878l4.17243,-5.27863l4.17243,-5.27863l-5.80056,-0.0001l0.00015,-8.55001l-5.08821,-0.00009l-0.00015,8.55001l-5.80056,-0.0001l-0.00001,-0.00001z m20,-5 l5.27878,-4.17224l5.27878,-4.17224l-5.27863,-4.17243l-5.27863,-4.17243l-0.0001,5.80056l-8.55001,-0.00015l-0.00009,5.08821l8.55001,0.00015l-0.0001,5.80056l-0.00001,0.00001z").dmove(60,0);
    this.dir_btn.click(function(){
      if (self.viewer._options.rankdir == "UD") {
        self.viewer._options.rankdir = "LR"
      } else {
        self.viewer._options.rankdir = "UD"
      }
      self.viewer.model();
    }).attr('style', 'cursor: pointer');
  }

  KerasModelEditor.prototype.draw_man = function() {
    let self = this;
    this.staticv = this.viewer.draw.group();
    this._man = this.viewer._el.parentElement;
    let source = document.createElement('div')
    source.setAttribute('id', 'json_source_editor')
    source.setAttribute('style', 'display: none;');
    this._man.appendChild(source);

    let overlay = document.createElement('div');
    overlay.className = 'overlay';
    source.appendChild(overlay);

    let container = document.createElement('div')
    container.setAttribute('id', 'json_source_container');
    source.appendChild(container);

    let tool_source_back = document.createElement('div')
    tool_source_back.setAttribute('id', 'tool_source_back');
    tool_source_back.className = 'toolbar_button';
    container.appendChild(tool_source_back);

    let tool_source_save = document.createElement('button')
    tool_source_save.setAttribute('id', 'tool_source_save');
    tool_source_save.addEventListener('click', function(e) {
      self.save_src();
    });
    tool_source_save.innerHTML='OK';
    tool_source_back.appendChild(tool_source_save);

    let tool_source_save_svg = document.createElement('svg');
    tool_source_save_svg.setAttribute('viewBox', '0 0 24 24')
    tool_source_save_svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    tool_source_save_svg.setAttribute('width', 16)
    tool_source_save_svg.setAttribute('height', 16);
    tool_source_save.appendChild(tool_source_save_svg);

    let tool_source_save_svg_path = document.createElement('path')
    tool_source_save_svg_path.setAttribute('d', 'm7.9,15.9l4.9,-0.05l0,-13.75l3.8,0l0,17.6l-8.7,0l0,-3.8z')
    tool_source_save_svg_path.setAttribute('trasform', 'rotate(45, 12, 10)')
    tool_source_save_svg_path.setAttribute('fill', '#005500');
    tool_source_save_svg.appendChild(tool_source_save_svg_path);

    let tool_source_cancel = document.createElement('button')
    tool_source_cancel.setAttribute('id', 'tool_source_cancel');
    tool_source_cancel.addEventListener('click', this.hide_dialog);
    tool_source_cancel.innerHTML='Cancel';
    tool_source_back.appendChild(tool_source_cancel);

    let tool_source_cancel_svg = document.createElement('svg');
    tool_source_cancel_svg.setAttribute('viewBox', '0 0 24 24')
    tool_source_cancel_svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    tool_source_cancel_svg.setAttribute('width', 16)
    tool_source_cancel_svg.setAttribute('height', 16);
    tool_source_cancel.appendChild(tool_source_cancel_svg);

    let tool_source_cancel_svg_path = document.createElement('path')
    tool_source_cancel_svg_path.setAttribute('d', 'm2.10526,10.52632l7.36842,0l0,-7.36842l3.68421,0l0,7.36842l7.36842,0l0,3.68421l-7.36842,0l0,7.36842l-3.68421,0l0,-7.36842l-7.36842,0l0,-3.68421z')
    tool_source_cancel_svg_path.setAttribute('trasform', 'rotate(45, 11.3, 12.3)')
    tool_source_cancel_svg_path.setAttribute('fill', '#550000');
    tool_source_cancel_svg.appendChild(tool_source_save_svg_path);

    let form = document.createElement('form')
    container.appendChild(form);

    let textarea = document.createElement('textarea');
    textarea.setAttribute('spellcheck', 'false')
    textarea.setAttribute('id', 'json_source_textarea')
    form.appendChild(textarea)
  }

  KerasModelEditor.prototype.show = function() {
    let self = this;
    this.viewer.show();
    this.draw_man();
    //this.draw_btns();
    this.viewer.layer_ndx = 'model'

  }

  function draw_btn(substrate, path_str){
    var btn = substrate.group();
    btn.circle(42).attr({"fill-opacity":0.1, "stroke-width":2}).move(8,8)
    btn.path(path_str)
    return btn
  }

  function show_menu(viewer, self, classs) {
    let { source_layers, layer_ndx, keras_args } = viewer;
    this.name = source_layers[layer_ndx].config.name || source_layers[layer_ndx].class_name

    this.Layer = classs //source_layers[layer_ndx].class_name
    this.trainable = source_layers[layer_ndx].config.trainable ? source_layers[layer_ndx].config.trainable : source_layers[layer_ndx].trainable


    for (let i in keras_args[classs].args){
      this[i] = (source_layers[layer_ndx].config[i] || source_layers[layer_ndx].config[i] === null) ? (source_layers[layer_ndx].config[i] || '') : keras_args[classs].args[i]
      if ( typeof this[i] === 'object') this[i] = JSON.stringify(this[i])

    }

    this["Edit Source"] = function(){
      self.show_source(source_layers[layer_ndx]);
      self.layer_editing=true;
    }

    this["Toggle Help"] = function(){
      self.toggle_help(layer_ndx)
    }
  };

  return KerasModelEditor;
}));
