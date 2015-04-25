
MESOS_MASTER = "http://demo-bliss.mesosphere.com:5050/"

REFRESH = true;
INTERVAL = 2000;
BOX_DURATION = 0;


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

  var total = 0;

  var shortest = function() {
    return _.sortBy([width, height], function(n) { return n })[0];
  };

  var ratio = shortest() / (dh + 50);

  // vis.attr("transform",
  //   "translate(" + [ dh*ratio, dh*ratio ] + ")scale(" + ratio +")");

  var add_box = function() {

    total += 1;
    var coords = [0, 0];
    var r = 0;
    var l = 1;

    // XXX - OFF BY ONE BITCHES
    if (total > 1) {

      var n = total;

      r = Math.floor(Math.ceil(Math.sqrt(n))/2);
      l = (r*2) + 1;
      var ring_index = n - Math.pow(l-2, 2) -1;

      var matrix = [
        [[-r, r], [1, 0]],
        [[r, r], [0, -1]],
        [[r, -r], [-1, 0]],
        [[-r, -r], [0, 1]]
      ];

      var base = matrix[Math.floor(ring_index/(l-1))];
      var mult = ring_index % (l - 1) + 1;

      coords = [
        base[0][0] + base[1][0] * mult,
        base[0][1] + base[1][1] * mult
      ];

    }

    vis.append("svg:rect")
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

    var ratio = shortest() / (l * dh);
    var edge = dh*r*ratio;

    vis.interrupt()
      .transition()
      .duration(1000)
      .attr("transform",
        "translate(" + [edge , edge] + ")scale(" + ratio + ")");
  };

  var remove_box = function() {
    var elem = d3.select(vis.selectAll("rect")[0].pop());

    var coords = [
      parseFloat(elem.attr("x")),
      parseFloat(elem.attr("y"))
    ];

    elem
      .transition()
      .duration(BOX_DURATION)
      .attr("x", coords[0] + dh/2)
      .attr("y", coords[1] + dh/2)
      .attr("width", 0)
      .attr("height", 0)
      .remove();
  };

  var state = [ {}, {} ];

  _.each(_.range(10), add_box);
  add_box();

  var selectors = {
    total: document.querySelector(".total-tasks .value"),
    marathon: document.querySelector(".marathon-tasks .value"),
    spark: document.querySelector(".spark-tasks .value"),
    cassandra: document.querySelector(".cassandra-tasks .value")
  };

  var handle_updates = function(e, tasks) {
    state.shift();
    state.push(tasks);

    var changes = diff(state[0], state[1]);

    var lastState = _.last(state);
    var totalTasks = _.reduce(lastState, function (memo, count, app) {
      return memo + count;
    }, 0);

    selectors.total.textContent = totalTasks;
    _.each(lastState, function (count, app) {
      if (selectors[app]) {
        selectors[app].textContent = count;
      }
    });

    // _.each(changes, function(c) {
    //   console.log(c);

    //   if (c.kind == "N") {
    //     _.each(_.range(c.rhs), add_box);
    //   }

    //   if (c.kind == "E") {
    //     var mod = c.rhs - c.lhs;
    //     var fn = mod > 0 ? add_box : remove_box;

    //     _.each(_.range(mod), fn);
    //   }
    // });

  };

  $("body").on("new_data", handle_updates);

  async.whilst(
    function () { return REFRESH }.bind(this),
    fetchState,
    function () { }
  );

});
