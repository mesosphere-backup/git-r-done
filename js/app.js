
MESOS_MASTER = "http://demo-bliss.mesosphere.com:5050/"

REFRESH = true;
INTERVAL = 2000;

$(function() {

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
        [_.map(data.frameworks, get_tasks)]);
      // _.delay(cb, INTERVAL);
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

  var add_box = function(n) {

    var r = Math.floor(Math.ceil(Math.sqrt(n))/2);
    var l = (r*2) + 1;
    var ring_index = n - Math.pow(l-2, 2) -1;

    var matrix = [
      [[-r, r], [1, 0]],
      [[r, r], [0, -1]],
      [[r, -r], [-1, 0]],
      [[-r, -r], [0, 1]]
    ];

    var base = matrix[Math.floor(ring_index/(l-1))];
    var mult = ring_index % (l - 1);

    var x = base[0][0] + base[1][0] * mult;
    var y = base[0][1] + base[1][1] * mult;

    vis.append("svg:rect")
      .attr("x", x * dh)
      .attr("y", y * dh)
      .attr("width", dh)
      .attr("height", dh)

    vis.attr("transform", "translate(" + [dh*r, dh*r] + ")");
  };


  // _.each(_.range(2,30+1), function(n) {

  //   add_box(n);

  // });

  var state = [ {}, {} ];

  var diff_tasks = function(prev, now) {

    return _.map(now, function(fw) {

      var old = _.find(prev, function(f) { return f.name == fw.name })

    });

  };

  var handle_updates = function(e, tasks) {

    state.shift();
    state.push(tasks);



  };

  $("body").on("new_data", handle_updates);

  async.whilst(
    function () { return REFRESH }.bind(this),
    fetchState,
    function () { }
  );

});
