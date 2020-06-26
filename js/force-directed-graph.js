
// function calculateForceData(country) {
// 	var nodeNames = Object.keys(inputData);
// 	var forceNodes = [];
// 	var forceLinks = [];
// 	// console.log(combined_similarities);
// 	for (var i = 0; i < nodeNames.length; i++) {
// 		forceNodes.push({ "character" : nodeNames[i] });
// 		var source = nodeNames[i];
// 		var targets = Object.entries(inputData[source]);
// 		for (var j = 0; j < targets.length; j++) {
// 			var target = targets[j][0];
// 			var targetIndex = nodeNames.indexOf(target);
// 			console.log(target, targetIndex);
// 			if (targetIndex >= 0) {
// 				forceLinks.push({
// 					"source" : i,
// 					"target" : nodeNames.indexOf(target),
// 					"weight" : targets[j][1].sim,
// 				})
// 			}
// 		}
// 	}
// 	// console.log(forceNodes);
// 	// console.log(forceLinks);
// 	return {
// 		"nodes" : forceNodes,
// 		"links" : forceLinks,
// 	}
// }

// function calculateForceData () {

// }

function getNodesAndLinks (inputData) {
  var countryCodes = {}
  // construct a dict with the country code of every country as its key
  for (var [countryPair, similarityScore] of Object.entries(inputData)) {
    var [countryA, countryB] = countryPair.split('->');
    countryCodes[countryA] = null;
    countryCodes[countryB] = null;
  }
  // marshall that into the d3-force shape
  // [{"id": "nodeName", ...}]
  var nodes = [];
  // simultaneously, associate alpha codes to node index
  var alphaToIndex = {}
  var i = 0
  for (var alpha3 of Object.keys(countryCodes)) {
    nodes.push({"id": alpha3});
    alphaToIndex[alpha3] = i;
    i+=1;
  }

  // now we produce links
  var links = []
  for (var [countryPair, similarityScore] of Object.entries(inputData)) {
    var [countryA, countryB] = countryPair.split('->');
    links.push({
      source: alphaToIndex[countryA],
      target: alphaToIndex[countryB],
      weight: similarityScore,
    });
  }

  return [nodes, links];
}


function generateSvg (width, height, marginLeft, marginTop) {
  return d3.select("#basic_chloropleth")
      .append("svg")
      .attr({"width": width, "height": height})
      .append("g")
      .attr("transform","translate("+marginLeft+","+marginTop+")");
}


function generateForceDirected() {
  // node circles
  var radius = 6;
  var padding = 20;
  var width = $('#basic_chloropleth').width();
  var height = $('#basic_chloropleth').height();
  // Create an SVG element and append it to the DOM
  var svgElement = generateSvg(width, height, 50, 20);
  // Extract data from dataset
  var [nodes, links] = getNodesAndLinks(INPUT_DATA)
  console.log(nodes)
  console.log(links)
  // var links = getLinks(INPUT_DATA)
  // Create Force Layout
  var force = d3.layout.force()
      .size([width, height])
      .nodes(nodes)
      .links(links)
      .gravity(0)
      .charge(0)
      .linkDistance(d => d.weight*50);
  // Add links to SVG
  var link = svgElement.selectAll(".link")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#add8e6")
      .attr("stroke-width", 1 )
      .attr("class", "link");
  // Add nodes to SVG
  var node = svgElement.selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(force.drag);
  // Add labels to each node
  var label = node.append("text")
      .attr("dx", 12)
      .attr("dy", "0.35em")
      .attr("font-size", 14)
      .text(d => d.id);
  // Add circles to each node
  var circle = node.append("circle")
      .attr("r", d => radius);

  // This function will be executed for every tick of force layout
  force.on("tick", function(){
    // Set X and Y of node
    node
      .attr("r", d => d.influence)
      .attr("cx", d =>
            d.x = Math.max(radius, Math.min(width - radius - padding, d.x)))
      .attr("cy", d =>
            d.y = Math.max(radius, Math.min(height - radius - padding, d.y)));
    // Set X, Y of link
    link.attr("x1", d => d.source.x);
    link.attr("y1", d => d.source.y);
    link.attr("x2", d => d.target.x);
    link.attr("y2", d => d.target.y);
    // Shift node a little
    node.attr("transform", function(d) {
      return "translate(" + d.x + "," + d.y + ")";
    });
  });
  // Start the force layout calculation
  force.start();
}
