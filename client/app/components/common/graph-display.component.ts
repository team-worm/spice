import { Component, ElementRef, Input, OnInit, AfterViewInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Observable } from "rxjs/Observable";
import * as d3 from 'd3';

export type GraphData = {nodes: DataNode[], edges: DataEdge[]};
export type DataNode = {id: number, data: string | null, trackedNodeValue: number | null; edgesOut: {[offset: number]: DataEdge}};
export type DataEdge = {id: string, source: DataNode & d3.SimulationNodeDatum, target: DataNode & d3.SimulationNodeDatum};

const targetAlpha = 0.0;
const minAlpha = 0.001;

@Component({
	selector: 'spice-graph-display',
	template: `<div></div>`
})

export class GraphDisplayComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
	@Input('width') width: number;
	@Input('height') height: number;
	@Input('data') data: GraphData;

	protected svg: d3.Selection<any,any,any,any>;
	protected view: d3.Selection<any,any,any,any>;
	protected margin: { top: number, right: number, bottom: number, left: number};
	protected simulation: d3.Simulation<d3.SimulationNodeDatum,d3.SimulationLinkDatum<d3.SimulationNodeDatum>>;
	protected edgesGroup: d3.Selection<any, any, any, any>;
	protected nodesGroup: d3.Selection<any, any, any, any>;
	protected allNodes: d3.Selection<any, any, any, any>;
	protected allEdges: d3.Selection<any, any, any, any>;
	protected linkForce: d3.ForceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>;
	protected trackedNodeCount: number = 0;
	protected trackedNodeColorInterpolator: any;

	constructor(protected el: ElementRef) {
		this.trackedNodeColorInterpolator = d3.interpolateRgb.gamma(2.2)('rgb(255,0,0)','rgb(0,255,0)');
	}

	public onDataUpdated(maxTrackedNodeValue: number) {
		this.trackedNodeCount = maxTrackedNodeValue;
		this.populate();
	}

	ngOnInit() {
	}

	ngAfterViewInit() {
		this.setup();
		this.buildSvg();
		this.populate();
	}

	ngOnChanges(changes: SimpleChanges) {
		//let nodes = [{id: 'a'},{id: 'b'},{id: 'c'},{id: 'd'}];
		//let edges = [
			//{id: 0, source: nodes[0], target: nodes[1]},
			//{id: 1, source: nodes[1], target: nodes[2]},
			//{id: 2, source: nodes[1], target: nodes[3]},
			//{id: 3, source: nodes[3], target: nodes[3]}];
		//this.data = {nodes: nodes, edges: edges};
		this.setup();
		this.buildSvg();
		this.populate();
	}

	ngOnDestroy() {
	}

	protected setup(): void {
		this.margin = { top: 20, right: 20, bottom: 40, left: 40 };
		//TODO: calculate width & height to fill parent
		//this.width = this.el.nativeElement.clientWidth - this.margin.left - this.margin.right;
		//this.height = this.el.nativeElement.clientHeight - this.margin.top - this.margin.bottom;
		//this.height = this.width * 0.5 - this.margin.top - this.margin.bottom;
	}

	protected buildSvg(): void {
		let root = d3.select(this.el.nativeElement);
		root.html('');

		root.append('svg')
			.attr('class', 'graph-display')
			.attr('width', this.width + this.margin.left + this.margin.right)
			.attr('height', this.height + this.margin.top + this.margin.bottom)
			.call(d3.zoom().on('zoom', () => {this.onZoomed();}))

		root.select('svg').append('rect') //used for zoom mouse detection
			.attr('x', 0.5)
			.attr('y', 0.5)
			.attr('width', this.width + this.margin.left + this.margin.right)
			.attr('height', this.height + this.margin.top + this.margin.bottom)
			.attr('fill', 'none')
			.attr('pointer-events', 'all');

		this.svg = root.select('svg')
			.append('g')
			.attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

		this.view = this.svg.append('g');


		this.view.append('defs').selectAll('marker')
			.data(['link'])
			.enter().append('marker')
				.attr('class', 'edge-end-marker')
				.attr('id', d => d)
				.attr("viewBox", "0 -5 10 10")
				.attr("refX", 15)
				.attr("refY", -1.5)
				.attr("markerWidth", 6)
				.attr("markerHeight", 6)
				.attr("orient", "auto")
			.append("path")
				.attr("d", "M0,-5L10,0L0,5");

		this.edgesGroup = this.view.append('g')
				.attr('class', 'edges');

		this.nodesGroup = this.view.append('g')
				.attr('class', 'nodes');


		this.simulation = d3.forceSimulation();
		this.linkForce = d3.forceLink().id((d:DataNode) => ''+d.id).distance(60);

		this.simulation
			.force("link",  this.linkForce)
			.force("charge", d3.forceManyBody()
								.strength(-120))
			.force("center", d3.forceCenter(this.width / 2, this.height / 2));
	}

	protected populate(): void {
		this.simulation.nodes(this.data.nodes).on('tick', () => {this.onSimulationTick();});
		this.linkForce.links(this.data.edges);

		this.simulation.alphaTarget(0).alphaMin(minAlpha).alpha(1).restart();
		//fast forward simulation until it settles
		for (let i = 0, n = Math.ceil(Math.log(this.simulation.alphaMin()) / Math.log(1 - this.simulation.alphaDecay())); i < n; ++i) {
			this.simulation.tick();
		}

		let edge = this.edgesGroup.selectAll('g')
			.data(this.data.edges, (e:DataEdge) => e.id);

		let newEdge = edge.enter()
			.append('g')
				.attr('class', 'edge');
		
		newEdge.append('line')
			.attr('marker-end', 'url(#edge)');

		edge.exit().remove();

		let node = this.nodesGroup.selectAll('g')
			.data(this.data.nodes, (d:DataNode) => ''+d.id);

		let newNode = node.enter()
			.append('g')
			.attr('class', 'node')
				.call(d3.drag()
					.on("start", (d) => {this.onDragStart(d);})
					.on("drag",  (d) => {this.onDrag(d);})
					.on("end",   (d) => {this.onDragEnd(d);}) as any);

		newNode.append('circle')
			.attr('class', 'node-circle')
			.attr('r', '15')

		newNode.append('circle')
			.attr('class', 'node-tracked-circle')
			.attr('r', '20')

		newNode.append('text')
			.attr('class', 'node-text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.text((d:DataNode) => d.data || '');

		node.exit().remove();

		this.allEdges = edge.merge(newEdge);
		this.allNodes = node.merge(newNode);

		this.allNodes.select('.node-tracked-circle')
			.style('stroke', (d:DataNode) => {
				if(d.trackedNodeValue === null) {
					return 'none';
				}
				return this.trackedNodeColorInterpolator(d.trackedNodeValue/(this.trackedNodeCount-1));
			});
	}

	protected onSimulationTick() {
		this.allEdges.selectAll('line')
			.attr("x1", (d: DataEdge) => d.source.x!)
			.attr("y1", (d: DataEdge) => d.source.y!)
			.attr("x2", (d: DataEdge) => d.target.x!)
			.attr("y2", (d: DataEdge) => d.target.y!)

		this.allNodes
			.attr('transform', (d:DataNode & d3.SimulationNodeDatum) => `translate(${d.x},${d.y})`);
	}

	protected onDragStart(d: d3.SimulationNodeDatum) {
		if (!d3.event.active) {
			this.simulation.alphaTarget(0.3).alphaMin(0).alpha(1).restart();
		}
		d.fx = d.x;
		d.fy = d.y;
	}

	protected onDrag(d: d3.SimulationNodeDatum) {
		d.fx = d3.event.x;
		d.fy = d3.event.y;
		//this.nodeClickHandler.apply(this, arguments);
	}

	protected onDragEnd(d: d3.SimulationNodeDatum) {
		if (!d3.event.active) {
			this.simulation.alphaTarget(targetAlpha).alphaMin(minAlpha);
		}
		d.fx = null;
		d.fy = null;
	}

	protected onZoomed() {
		this.view.attr('transform', d3.event.transform);
	}
}

