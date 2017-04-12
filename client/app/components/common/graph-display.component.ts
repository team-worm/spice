import { Component, ElementRef, Input, OnInit, AfterViewInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Observable } from "rxjs/Observable";
import * as d3 from 'd3';

export type GraphData = {nodes: DataNode[], edges: DataEdge[]};
export type DataNode = {id: string};
export type DataEdge = {source: DataNode & d3.SimulationNodeDatum, target: DataNode & d3.SimulationNodeDatum};

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
	protected nodesGroup: any; //svg group
	protected edgesGroup: any;

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
		let nodes = [{id: 'a'},{id: 'b'},{id: 'c'},{id: 'd'}];
		let edges = [
			{source: nodes[0], target: nodes[1]},
			{source: nodes[1], target: nodes[2]},
			{source: nodes[1], target: nodes[3]},
			{source: nodes[3], target: nodes[3]}];
		this.data = {nodes: nodes, edges: edges};
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


		this.nodesGroup = this.svg.append('g')
			.attr('class', 'nodes');

		this.edgesGroup = this.svg.append('g')
			.attr('class', 'link');

		this.simulation = d3.forceSimulation()
			.force("link", d3.forceLink().id((d:DataNode) => d.id).distance(60))
			.force("charge", d3.forceManyBody()
								.strength(-120))
								.force("center", d3.forceCenter(this.width / 2, this.height / 2));
	}

	protected populate(): void {
		this.simulation.nodes(this.data.nodes).on('tick', ticked);

		//this.simulation.force('link')
			//.links(this.data.edges);
			//.id(e => d.id);

		this.simulation.alphaTarget(0.3).restart();


		let edge = this.edgesGroup.selectAll('g')
			.data(this.data.edges, (e:DataEdge) => `${e.source},${e.target}`);

		let newEdge = edge.enter().append('g');
			newEdge.append('line')
				.attr('marker-end', 'url(#edge)')
				.attr("stroke", "#aaa")
				.attr("stroke-width", '1');

		edge.exit().remove();

		let node = this.nodesGroup.selectAll('g')
			.data(this.data.nodes, (d:DataNode) => d.id);

		node.selectAll('text').attr("fill", '#f00');
		//node.selectAll('text').attr("fill", (d:DataNode) => {
			//if(d.explored) {
				//return _this.color(2);
			//}
			//else {
				//return _this.color(/*d.group*/1); } });

		let newNode = node.enter().append('g');
		newNode.append('text')
				.text((d:DataNode) => d.id)
				.attr('fill', '#0f0');
				
		//newNode.call(d3.drag()
					//.on("start", dragstarted)
					//.on("drag", dragged)
					//.on("end", dragended));

		//newNode.append('text')
			//.text(function(d) { return d.word; })
			//.attr("fill", function(d) { if(d.explored) { return _this.color(3); } else { return _this.color(/*d.group*/1); } });

		node.exit().remove();

		let allEdge = edge.merge(newEdge);
		let allNode = node.merge(newNode);

		function ticked() {
			allEdge.selectAll('line')
				.attr("x1", (d: DataEdge) => d.source.x)
				.attr("y1", (d: DataEdge) => d.source.y)
				.attr("x2", (d: DataEdge) => d.target.x)
				.attr("y2", (d: DataEdge) => d.target.y)

			allNode
				.attr('transform', (d:DataNode & d3.SimulationNodeDatum) => `translate(${d.x},${d.y})`);
		}
		//this.svg.append
		/*
		this.xScale.domain(d3.extent(this.data, (d: DataXY) => d.x) as [any, any]);
		this.yScale.domain(d3.extent(this.data, (d: DataXY) => d.y) as [any, any]);

		this.svg.append('path')
			.attr('class', 'line');

		let path = this.svg.selectAll('path').datum(this.data);
			path
			.attr('d', d3.line<DataXY>()
				.x((d: any) => this.xScale(d.x))
				.y((d: any) => this.yScale(d.y)));

		this.svg.selectAll('.x.axis')
			.call(this.xAxis);
		this.svg.selectAll('.y.axis')
			.call(this.yAxis);
		*/
	}
}

