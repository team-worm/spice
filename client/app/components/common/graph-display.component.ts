import { Component, ElementRef, Input, OnInit, AfterViewInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Observable } from "rxjs/Observable";
import * as d3 from 'd3';

export type GraphData = {nodes: DataNode[], edges: DataEdge[]};
export type DataNode = {id: string};
export type DataEdge = {id: number, source: DataNode & d3.SimulationNodeDatum, target: DataNode & d3.SimulationNodeDatum};

@Component({
	selector: 'spice-graph-display',
	template: `<div></div>`
})
export class GraphDisplayComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
	@Input('width') width: number;
	@Input('height') height: number;
	@Input('data') data: GraphData;

	protected svg: d3.Selection<any,any,any,any>;
	protected margin: { top: number, right: number, bottom: number, left: number};
	protected simulation: d3.Simulation<d3.SimulationNodeDatum,d3.SimulationLinkDatum<d3.SimulationNodeDatum>>;
	protected allNodes: d3.Selection<any, any, any, any>;
	protected allEdges: d3.Selection<any, any, any, any>;
	protected linkForce: d3.ForceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>;

	constructor(protected el: ElementRef) {
	}

	public onDataUpdated() {
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

		this.svg = root.append('svg')
			.attr('class', 'graph-display')
			.attr('width', this.width + this.margin.left + this.margin.right)
			.attr('height', this.height + this.margin.top + this.margin.bottom)
			.append('g')
			.attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');


		this.svg.append('defs').selectAll('marker')
			.data(['link'])
			.enter().append('marker')
				.attr('id', d => d)
				.attr("viewBox", "0 -5 10 10")
				.attr("refX", 15)
				.attr("refY", -1.5)
				.attr("markerWidth", 6)
				.attr("markerHeight", 6)
				.attr("orient", "auto")
				.attr('fill', '#aaa')
			.append("path")
				.attr("d", "M0,-5L10,0L0,5");


		this.simulation = d3.forceSimulation();
		this.linkForce = d3.forceLink().id((d:DataNode) => d.id).distance(60);

		this.simulation
			.force("link",  this.linkForce)
			.force("charge", d3.forceManyBody()
								.strength(-120))
			.force("center", d3.forceCenter(this.width / 2, this.height / 2));
	}

	protected populate(): void {
		this.simulation.nodes(this.data.nodes).on('tick', () => {this.onSimulationTick();});
		this.linkForce.links(this.data.edges);

		this.simulation.alphaTarget(0.3).restart();

		let edge = this.svg.append('g')
				.attr('class', 'link')
			.selectAll('g')
				.data(this.data.edges, (e:DataEdge) => ''+e.id);

		let newEdge = edge.enter().append('g');
		
		newEdge.append('line')
			.attr('marker-end', 'url(#edge)')
			.attr("stroke", "#aaa")
			.attr("stroke-width", '1');

		edge.exit().remove();

		let node = this.svg.append('g')
				.attr('class', 'nodes')
			.selectAll('g')
				.data(this.data.nodes, (d:DataNode) => d.id);

		let newNode = node.enter().append('g');
		
		newNode.append('circle')
			.attr('r', 5)
			.attr('fill', '#4f4');
		//newNode.append('text')
			//.text((d:DataNode) => d.id)
			//.attr('fill', '#0f0');
			//.call(d3.drag()
				//.on("start", dragstarted)
				//.on("drag", dragged)
				//.on("end", dragended));

		node.exit().remove();

		this.allEdges = edge.merge(newEdge);
		this.allNodes = node.merge(newNode);
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
}

