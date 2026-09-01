import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExploradorPhygital } from './explorador-phygital';

describe('ExploradorPhygital', () => {
  let component: ExploradorPhygital;
  let fixture: ComponentFixture<ExploradorPhygital>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExploradorPhygital],
    }).compileComponents();

    fixture = TestBed.createComponent(ExploradorPhygital);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
