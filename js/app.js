
MESOS_MASTER = "http://demo-bliss.mesosphere.com:5050/"

REFRESH = true;
INTERVAL = 2000;
BOX_DURATION = 2000;
RING_DURATION = 500;
ZOOM_DURATION = 1000;


$(function() {

  var diff = DeepDiff.diff;


  var url = MESOS_MASTER + "state.json"

  var STATE = [];

  var get_tasks = function(fw) {

    var len = fw.tasks ? _.filter(fw.tasks, function(t) {
      return t.state == "TASK_RUNNING"
    }).length : 0;

    return {
      "name": fw.name.split("-")[0],
      "task_count": len
    };

  };

  var fetchState = function(cb) {
    $.getJSON(url + "?jsonp=?").done(function(data) {
      $("body").trigger("new_data",
        [_.reduce(data.frameworks, function(acc, fw) {
          var tasks = get_tasks(fw);
          acc[tasks.name] = tasks.task_count;
          return acc;
        }, {})]);
      _.delay(cb, INTERVAL);
    });
  };

  var el = $(".canvas");
  var width = el.width();
  var height = el.height();
  var dh = 100;

  var vis = d3.select(".canvas")
    .append("svg:svg")
    .attr("width", width)
    .attr("height", height)
    .append("g");

  var translation = 0;

  var all_boxes = [];

  var total = 0;

  var shortest = function() {
    return _.sortBy([width, height], function(n) { return n })[0];
  };

  var ratio = shortest() / dh;

  vis.attr("transform",
    "translate(" + [ 0, 0 ] + ")scale(" + ratio +")");

  var calculate_size = function(n) {

    var r = Math.floor(Math.ceil(Math.sqrt(n))/2);
    var l = (r*2) + 1;

    return [r, l];
  };

  var set_canvas = function(r, l) {
    var ratio = shortest() / (l * dh);
    var edge = dh*r*ratio;

    vis.transition()
      .duration(RING_DURATION)
      .ease("linear")
      .attr("transform",
        "translate(" + [edge , edge] + ")scale(" + ratio + ")");
  }

  var current_r = 0;

  var get_coords = function(n) {
    var size = calculate_size(n);

    var r = size[0];
    var l = size[1];

    var ring_index = n - Math.pow(l-2, 2) -1;

    var matrix = [
      [[-r, r], [1, 0]],
      [[r, r], [0, -1]],
      [[r, -r], [-1, 0]],
      [[-r, -r], [0, 1]]
    ];

    var base = matrix[Math.floor(ring_index/(l-1))];
    var mult = ring_index % (l - 1) + 1;

    return [
      base[0][0] + base[1][0] * mult,
      base[0][1] + base[1][1] * mult
    ];
  };

  var box_fns = {
    "add": function(name) {

      total += 1;
      var coords = [0, 0];

      // XXX - OFF BY ONE BITCHES
      if (total > 1) {
        coords = get_coords(total);
      }

      vis.append("svg:rect")
        .classed("show", true)
        .classed(name, true)
        .attr("n", total)
        .attr("x", coords[0] * dh + dh/2)
        .attr("y", coords[1] * dh + dh/2)
        .attr("width", 0)
        .attr("height", 0)
        .transition()
        .duration(BOX_DURATION)
        .attr("x", coords[0] * dh)
        .attr("y", coords[1] * dh)
        .attr("width", dh)
        .attr("height", dh);

    },
    "remove": function(name, i) {
      var elem = d3.select(vis.selectAll("rect.show." + name)[0].pop());

      var coords = [
        parseFloat(elem.attr("x")),
        parseFloat(elem.attr("y"))
      ];

      elem
        .classed("show", false)
        .transition()
        .duration(BOX_DURATION)
        .attr("x", coords[0] + dh/2)
        .attr("y", coords[1] + dh/2)
        .attr("width", 0)
        .attr("height", 0)
        .remove();

      var to_shift = total - parseInt(elem.attr("n"));
      if (to_shift > 0) {
        box_fns.shift(_.last(vis.selectAll("rect.show")[0], to_shift));
      }

      total -= 1;
      var size = calculate_size(total);
      set_canvas(size[0], size[1]);
    },
    "shift": function(elems) {
      d3.selectAll(elems)
        .attr("n", function() {
          return parseInt(d3.select(this).attr("n")) - 1;
        })
        .transition()
        .duration(RING_DURATION)
        .attr("x", function() {
          return get_coords(parseInt(d3.select(this).attr("n")))[0] * dh;
        })
        .attr("y", function() {
          return get_coords(parseInt(d3.select(this).attr("n")))[1] * dh;
        })
    }
  };

  var selectors = {
    total: document.querySelector(".total-tasks .value"),
    marathon: document.querySelector(".marathon-tasks .value"),
    spark: document.querySelector(".spark-tasks .value")
    // cassandra: document.querySelector(".cassandra-tasks .value")
  };

  function animateCount (el, end) {
    d3.select(el).interrupt()
      .data([end])
      .transition()
      .duration(1000)
        .tween("text", function(d) {
           var i = d3.interpolate(this.textContent, d);

           return function(t) {
             this.textContent = Math.round(i(t)) | 0;
           };
         });
  }

  var state = [ {}, {} ];

  var handle_updates = function(e, tasks) {
    state.shift();
    state.push(tasks);

    var changes = diff(state[0], state[1]);

    var lastState = _.last(state);
    var totalTasks = _.reduce(lastState, function (memo, count, app) {
      return memo + count;
    }, 0);

    // Total
    animateCount(selectors.total, totalTasks);
    // Apps
    _.each(lastState, function (count, app) {
      if (!selectors[app]) {
        return;
      }

      animateCount(selectors[app], count);
    });

    var boxes = [];
    _.each(changes, function(c) {

      // XXX - YES, THIS IS LAZY, I KNOW WHAT I'M DOING

      if (c.kind == "N") {
        _.each(_.range(c.rhs), function() {
          boxes.push({
            "method": "add",
            "fw": c.path[0]
          });
        });
      }

      if (c.kind == "E") {
        var mod = c.rhs - c.lhs;
        var fn = mod > 0 ? "add" : "remove";

        _.each(_.range(Math.abs(mod)), function() {
          boxes.push({
            "method": fn,
            "fw": c.path[0]
          });
        });
      }

    });

    var parts = _.reduce(_.shuffle(boxes), function(acc, v, k) {
      var i = calculate_size(k + total + 1);

      _.each(_.range((i[0] + 1) - acc.length), function() {
        acc.push({
          s: i,
          data: []
        });
      });

      acc[i[0]].data.push(v);
      return acc;
    }, []);

    parts = _.filter(parts, function(p) {
      return p.data.length > 0;
    });

    async.eachSeries(parts, function(boxes, cb) {
      var wait = Math.floor(RING_DURATION / boxes.data.length);

      _.each(boxes.data, function(b, i) {
        _.delay(box_fns[b.method], wait * i, b.fw);
      });

      set_canvas(boxes.s[0], boxes.s[1], 2);
      _.delay(cb, RING_DURATION);
    }, function() { });
  };

  $("body").on("new_data", handle_updates);

  async.whilst(
    function () { return REFRESH }.bind(this),
    fetchState,
    function () { }
  );

});
