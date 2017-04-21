import { Component, ElementRef, Input, OnInit, AfterViewInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Observable } from "rxjs/Observable";
import * as d3 from 'd3';

export type DataXY = {x: number, y: number};

/** Line Graph Component
 * Draws a line graph
 */
@Component({
	selector: 'spice-line-graph',
	template: `<div></div>`
})

export class LineGraphComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
	@Input('width') width: number;
	@Input('height') height: number;
	@Input('data') data: DataXY[];

	protected svg: d3.Selection<any,any,any,any>;
	protected xAxis: d3.Axis<any>;
	protected yAxis: d3.Axis<any>;
	protected margin: { top: number, right: number, bottom: number, left: number};
	protected xScale: d3.ScaleContinuousNumeric<any,any>;
	protected yScale: d3.ScaleContinuousNumeric<any,any>;

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
		this.xScale = d3.scaleLinear().range([0, this.width]);
		this.yScale = d3.scaleLinear().range([this.height, 0]);
	}

	protected buildSvg(): void {
		let root = d3.select(this.el.nativeElement);
		root.html('');

		this.svg = root.append('svg')
			.attr('class', 'line-graph')
			.attr('width', this.width + this.margin.left + this.margin.right)
			.attr('height', this.height + this.margin.top + this.margin.bottom)
			.append('g')
			.attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

		this.xAxis = d3.axisBottom(this.xScale);
		this.svg.append('g')
			.attr('class', 'x axis')
			.attr('transform', `translate(0,${this.height})`)
			.call(this.xAxis);

		this.yAxis = d3.axisLeft(this.yScale);
		this.svg.append('g')
			.attr('class', 'y axis')
			.call(this.yAxis);
	}

	protected populate(): void {
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
	}
}

