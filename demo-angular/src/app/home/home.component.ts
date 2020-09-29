import { Component, OnInit } from "@angular/core";
import {
  AndroidData,
  Elevation,
  Shape,
  ShapeEnum
} from "nativescript-ngx-shadow";

import { ListPicker } from "@nativescript/core";

@Component({
  moduleId: module.id,
  selector: "Home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.css"]
})
export class HomeComponent implements OnInit {
  elevation = 2;
  shape = ShapeEnum;
  stdElevations: string[] = [];
  androidData: AndroidData;
  bclass = "ex2";
  bclass2 = "ex3";
  bclass3 = "ex4";

  ngOnInit(): void {
    for (const x in Elevation) {
      if (isNaN(parseInt(x, 10))) {
        this.stdElevations.push(x);
      }
    }
    this.androidData = this.getAndroidData();
  }

  getAndroidData(): AndroidData {
    return {
      elevation: this.elevation,
      // bgcolor: "#ff1744",
      // shape: ShapeEnum.OVAL
    };
  }

  toggleClass() {
    this.bclass = this.bclass == "ex2" ? "ex3" : "ex2";
    this.bclass2 = this.bclass2 == "ex3" ? "ex4" : "ex3";
    this.bclass3 = this.bclass3 == "ex4" ? "ex3" : "ex4";
  }

  setElevation(newValue) {
    const picker = newValue.object as ListPicker;
    this.elevation = Elevation[this.stdElevations[picker.selectedIndex]];
    this.androidData = this.getAndroidData();
  }

  dummy() {} //dummy tap function to make a view clickable
}
