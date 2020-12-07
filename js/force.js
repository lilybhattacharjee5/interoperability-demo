// import necessary libraries from root index file
import {
  jQuery,
  d3,
} from './index.js';

// import global constants from root index file
import {
  data,
} from './index.js';

// import general methods from root index file
import {
  alpha3ToCountryName,
  selectCountry,
  attrToLegendColor,
  generateDataObj,
  createLegendHTML,
} from './index.js';

// import constants from external file
const constants = require('./constants.js');

/**
* Description. Separate node and link data from global INPUT_DATA variable
* @param  inputData   formatted dictionary mapping country pairs e.g. AND->AUT to a dictionary of 
* calculated metrics
* @return   Returns a list in which the first element is a list of node objects and the second
* element is a list of link objects in the following form:
* [
*   [
*     {
*       id: alpha 3 code
*     },
*     ...
*   ],
*   [
*     {
*       source: alpha 3 code representing the node corresponding to the source country,
*       target: alpha 3 code representing the node corresponding to the target country,
*       attr: float metric value between 0 and 1 inclusive,
*       weight: attribute used to determine link distance,
*     }
*   ] 
* ]
*/
function getNodesAndLinks(inputData, attrName) {
  let countryCodes = {}
  // construct a dict with the country code of every country as its key
  for (let countryPair of Object.keys(inputData)) {
    let [countryA, countryB] = countryPair.split('->');
    countryCodes[countryA] = null;
    countryCodes[countryB] = null;
  }
  // marshall that into the d3-force shape
  // [{"id": "nodeName", ...}]
  let nodes = [];
  // simultaneously, associate alpha codes to node index
  let alphaToIndex = {};
  let i = 0;
  for (let alpha3 of Object.keys(countryCodes)) {
    nodes.push({"id": alpha3});
    alphaToIndex[alpha3] = i;
    i += 1;
  }

  // now we produce links
  let links = []
  for (let [countryPair, metrics] of Object.entries(inputData)) {
    // TODO why do we need to *100? hidden constants?
    let attrVal = metrics[attrName]*100;
    let [countryA, countryB] = countryPair.split('->');
    let newLink;
    if (100 - attrVal >= 0 && attrVal > 0) {
      newLink = {
        source: alphaToIndex[countryA],
        target: alphaToIndex[countryB],
        weight: 100 - attrVal,
      };
      newLink[attrName] = attrVal;
      links.push(newLink);
    }
  }

  return [nodes, links];
}

/** 
* Description. Calculate the average attr value in the dataset to determine which edges will
* have high (low attr value, almost transparent) vs. low opacity (high attr value)
* @param  links   array of link objects of the following form:
* [
*   {
*     source: alpha 3 code representing the node corresponding to the source country,
*     target: alpha 3 code representing the node corresponding to the target country,
*     attr: float metric value between 0 and 1 inclusive,
*     weight: attribute used to determine link distance,
*   }
* ]
* @return   Returns a float value representing the mean attr value between any two source,
* target pairs
*/
function calculateMeanAttrVal(links, attrName) {
  let count = 0;
  let attrSum = 0;
  for (let link of links) {
    attrSum += link[attrName];
    count++;
  }
  return attrSum / count;
}

/**
* Description. Generate the SVG image holding the visualization 
* @param  width       css width value for the SVG visualization container
* @param  height      css height value for the SVG visualization container
* @param  marginLeft  css margin left value for the SVG visualization container
* @param  marginTop   css margin top value for the SVG visualization container
* @param  options     a dictionary of user-defined options (see README for details)
*/
function generateSvg (width, height, marginLeft, marginTop, options) {
  const visId = options.visId;

  return d3.select(`#${visId}_${constants.visDisplay}`)
      .append("svg")
      .attr({"width": width, "height": height})
      .append("g")
}

/** 
* Description. Calculate the height of the force visualization as the max edge length * 2 
* (in case there are 2 such edge lengths that end up spanning the height after rebalancing)
* @param  links   array of link objects with attributes including source, target, attr, weight, etc.
* @return   Returns the maximum possible height (in px) for the visualization to properly fit visible
* edges
*/
function calculateHeight (links) {
  let maxLength = -Infinity;
  let currLength;
  for (let link of links) {
    currLength = link.weight * 5;
    if (currLength > maxLength) {
      maxLength = currLength;
    }
  }
  return maxLength * 2;
}

/**
* Description. Finds the node object that matches the passed-in alpha 3 code.
* @param  nodes   array of node objects with attributes including id, etc.
* @param  alpha3  a 3-letter country code
* @return Returns the first node that matches the query i.e. the id is the same as the alpha 3 parameter
*/
function findNode(nodes, alpha3) {
  const countryNode = nodes.filter(nodeInfo => nodeInfo.id === alpha3);
  return countryNode.length > 0 ? countryNode[0] : null;
}

/**
* Description. Uses the global data variable to generate a force graph with undirected edges
* between countries with corresponding edge lengths based on pairwise attr values 
* @param  options   a dictionary of user-defined options (see README for details)
*/
export function generateForceDirected(options) {
  // finds min & max attr values between any country pair in the dataset
  const visId = options.visId;
  const forceProperties = options[`${constants.force}${constants.properties}`];
  const mapHeight = forceProperties.mapHeight;
  const multiplier = forceProperties.linkMultiplier;
  const selectedCountry = forceProperties.selectedCountry;
  const attrName = forceProperties.visibleProperty;
  let interactive = forceProperties.interactive;
  
  createLegendHTML(options);

  /* Initial force graph settings */
  const radius = 6; // node size
  const padding = 100; // pads graph from edges of visualization
  const forceGraph = document.getElementById(`${visId}_${constants.visDisplay}`);
  const width = forceGraph.offsetWidth;
  const height = forceGraph.offsetHeight;
  
  // extract data from dataset
  let [nodes, links] = getNodesAndLinks(data, attrName);
  forceGraph.style.height = mapHeight;

  // create an SVG element and append it to the DOM
  const svgElement = generateSvg(width, height, 50, 20, options);
  
  // create force layout
  let forceLayout = d3.layout.force()
    .size([width, height])
    .nodes(nodes)
    .links(links)
    .gravity(0) // no attraction between nodes
    .charge(-3000) // repulse nodes so text is more visible & to prevent overlapping
    .linkDistance(d => d.weight * multiplier); // set edge length based on multiplier

  // add links to SVG
  let link = svgElement.selectAll(".link")
    .data(links)
    .enter()
    .append("line")
    .attr("stroke", d => {
      return attrToLegendColor(d[attrName] / 100, options)
    })
    .attr("stroke-width", 1)
    .attr("class", "link");
  
  // Increase node size & decrease opacity on node mouseover
  function mouseover() {
    if (!interactive) {
      return;
    }

    d3.select(this).transition()
      .duration(100)
      .attr("r", radius * 2)
      .attr("background-color", "#FFFBCC")
      .attr("opacity", 0.5);
  }

  // Reverse the effects of mouseover on the node
  function mouseout() {
    if (!interactive) {
      return;
    }

    d3.select(this).transition()
      .duration(100)
      .attr("r", radius)
      .attr("color", "black")
      .attr("opacity", 1);
  }

  // add nodes to SVG
  let node = svgElement.selectAll(".node")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .call(forceLayout.drag);
  
  // add labels to each node
  node.append("text")
    .attr("dx", 12)
    .attr("dy", "0.35em")
    .attr("font-size", 14)
    .text(d => d.id);
  
  // add circles to each node & attach mouseover, mouseout functions
  let circle = node.append("circle")
    .attr("r", () => radius)
    .on("mouseover", mouseover)
    .on("mouseout", mouseout);

  let flag = false; // reload all nodes if flag is set
  let clickedNode; // keep track of selected node in the scope of the function

  // reload force graph data when a node is selected
  function selectCircle(d) {
    if (!interactive) {
      return;
    }

    // make attr value table visible again
    document.getElementById(`${visId}_${constants.attrTable}`).style.display = 'flex';
    document.getElementById(`${visId}_${constants.selectedCountry}`).style.display = 'block';

    forceLayout.stop();
    let thisNode = d.id;

    // only include links connected to selected node
    links = oldLinks.filter(function(l) {
      let source = l.source;
      let target = l.target;
      if (typeof source != "number") {
        source = l.source.index;
      }
      if (typeof target != "number") {
        target = l.target.index;
      }
      let sourceName = nodes[source].id;
      let targetName = nodes[target].id;

      return (sourceName === thisNode) || (targetName === thisNode);
    });
    link.remove();
    link = svgElement.selectAll('.link')
      .data(links)
      .enter().append('line')
      .attr("class", "link")
      .attr("stroke", d => {
        return attrToLegendColor(d[attrName] / 100, options)
      })
      .attr("stroke-width", 1);
    
    flag = true;
    clickedNode = d;

    // redefine visualization settings & start force to rebalance graph with new links
    forceLayout.links(links);
    forceLayout.nodes(nodes);
    forceLayout.charge(-100)
    forceLayout.linkDistance(d => d.weight * multiplier)
    forceLayout.start()

    selectCountry(generateDataObj(data), alpha3ToCountryName(d.id), options);
  }

  // This function will be executed for every tick of force layout
  forceLayout.on("tick", function(){
    // set node positions (x, y)
    node
      .attr("cx", d => {
        if (clickedNode && d.id === clickedNode.id) {
          d.x = d.x + Math.round(width / 2 - d.x);
        } else {
          d.x = Math.max(radius + padding, Math.min(width - radius - padding, d.x));
        }
      })
      .attr("cy", d => {
        if (clickedNode && d.id === clickedNode.id) {
          d.y = d.y + Math.round(height / 2 - d.y);
        } else {
          d.y = Math.max(radius + padding, Math.min(height - radius - padding, d.y));
        }
      });
    
    // set link positions (x, y)
    if (flag) {
      link.attr("x1", d => nodes[d.source.index].x)
        .attr("y1", d => nodes[d.source.index].y)
        .attr("x2", d => nodes[d.target.index].x)
        .attr("y2", d => nodes[d.target.index].y)
        .attr("stroke", d => {
          return attrToLegendColor(d[attrName] / 100, options)
        });
    } else {
      link.attr("x1", d => d.source.x);
      link.attr("y1", d => d.source.y);
      link.attr("x2", d => d.target.x);
      link.attr("y2", d => d.target.y);
    }

    // shift node a little for rebalancing
    node.attr("transform", function(d) {
      return "translate(" + d.x + "," + d.y + ")";
    });
  });

  // track original set of links
  let oldLinks = jQuery.extend(true, [], links);

  // when the reset button is pressed, restore all of the links in the original dataset
  d3.select(`#${visId}_${constants.resetButton}`).on('click', function() {
    options.forceProperties.selectedCountry = undefined;

    // remove attr value table
    document.getElementById(`${visId}_${constants.attrTable}`).style.display = 'none';
    document.getElementById(`${visId}_${constants.selectedCountry}`).style.display = 'none';

    links = oldLinks;
    link.remove();
    node.remove();
    link = svgElement.selectAll('.link')
      .data(links)
      .enter().append('line')
      .attr('class', 'link')
      .attr("stroke", d => {
        return attrToLegendColor(d[attrName] / 100, options)
      })
      .attr('stroke-width', 1)
    node = svgElement.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(forceLayout.drag);
    node.append('text')
      .attr('dx', 12)
      .attr('dy', '0.35em')
      .attr('font-size', 14)
      .text(d => d.id);
    circle = node.append('circle')
      .attr('r', () => radius)
      .on('mouseover', mouseover)
      .on('mouseout', mouseout);
    circle.on('click', selectCircle);
    flag = false
    forceLayout.links(links);
    forceLayout.nodes(nodes);
    forceLayout.charge(-3000)
    forceLayout.linkDistance(d => d.weight * 5)
    forceLayout.start()
  })

  // call the selectCircle function whenever a circle is clicked
  circle.on('click', selectCircle);

  const selectedNode = findNode(nodes, selectedCountry);
  if (selectedNode) {
    const tempInteractive = interactive;
    interactive = true;
    selectCircle(selectedNode);
    interactive = tempInteractive;
  }

  // start the force layout calculation
  forceLayout.start();
}
