import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  Renderer2,
  AfterViewInit,
  OnDestroy
} from '@angular/core';
import { isAndroid, isIOS } from 'tns-core-modules/platform';

import { AndroidData } from './common/android-data.model';
import { IOSData } from './common/ios-data.model';
import { Shadow } from './common/shadow';
import { Shape, ShapeEnum } from './common/shape.enum';
import { View } from 'tns-core-modules/ui/page/page';
import { StackLayout } from 'tns-core-modules/ui/layouts/stack-layout';
import { addWeakEventListener, removeWeakEventListener } from "tns-core-modules/ui/core/weak-event-listener";

@Directive({ selector: '[shadow]' })
export class NativeShadowDirective implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() shadow: string | AndroidData | IOSData;
  @Input() elevation?: number | string;
  @Input() pressedElevation?: number | string;
  @Input() shape?: Shape;
  @Input() bgcolor?: string;
  @Input() cornerRadius?: number | string;
  @Input() translationZ?: number | string;
  @Input() pressedTranslationZ?: number | string;
  @Input() forcePressAnimation?: boolean;
  @Input() maskToBounds?: boolean;
  @Input() shadowColor?: string;
  @Input() shadowOffset?: number | string;
  @Input() shadowOpacity?: number | string;
  @Input() shadowRadius?: number | string;
  @Input() useShadowPath?: boolean;
  @Input() rasterize?: boolean;

  private loaded = false;
  private initialized = false;
  private originalNSFn: any;
  private previousNSFn: any;
  private iosShadowRapper: View;
  private eventsBound = false;

  constructor(private el: ElementRef, private render: Renderer2) {
    if (isAndroid) {
      this.originalNSFn = this.el.nativeElement._redrawNativeBackground; //always store the original method
    }
  }

  ngOnInit() { // RadListView calls this multiple times for the same view
    if (!this.initialized) {
      this.initialized = true;
      this.initializeCommonData();
      if (isAndroid) {
        this.initializeAndroidData();
      } else if (isIOS) {
        this.initializeIOSData();
      }
      if (this.shadow && (this.shadow as AndroidData | IOSData).elevation) {
        if (isAndroid) {
          this.loadFromAndroidData(this.shadow as AndroidData);
        } else if (isIOS) {
          this.loadFromIOSData(this.shadow as IOSData);
        }
      }
      this.bindEvents();
    }
  }

  ngOnDestroy() {
    if (this.initialized) {
      this.unbindEvents();
      this.initialized = false;
    }
  }

  // NS ListViews create elements dynamically
  // loaded and unloaded are called before angular is "ready"
  // https://github.com/NativeScript/nativescript-angular/issues/1221#issuecomment-422813111
  // So we ensure we're running loaded/unloaded events outside of angular
  bindEvents() {
    if (!this.eventsBound) {
      addWeakEventListener(this.el.nativeElement, View.loadedEvent, this.onLoaded, this);
      addWeakEventListener(this.el.nativeElement, View.unloadedEvent, this.onUnloaded, this);
      this.eventsBound = true;
      // in some cases, the element is already loaded by time of binding
      if (this.el.nativeElement.isLoaded) {
        this.onLoaded();
      }
    }
  }

  unbindEvents() {
    if (this.eventsBound) {
      removeWeakEventListener(this.el.nativeElement, View.loadedEvent, this.onLoaded, this);
      removeWeakEventListener(this.el.nativeElement, View.unloadedEvent, this.onUnloaded, this);
      this.eventsBound = false;
    }
  }

  onLoaded() {
    this.loaded = true;
    // Weirdly ngOnInit isn't called on iOS on demo app
    // Managed to get it working on iOS when applying to
    // FlexboxLayout, but on the demo app, we apply to a
    // Label, and, for that case, ngOnInit isn't called

    // This is just enforcing the Directive is initialized
    // before calling this.applyShadow()
    if (!this.initialized) {
      this.ngOnInit();
    }
    this.applyShadow();
    if (isAndroid) {
      this.previousNSFn = this.el.nativeElement._redrawNativeBackground; // just to maintain compatibility with other patches
      this.el.nativeElement._redrawNativeBackground = this.monkeyPatch;
    }
  }

  private addIosWrapper() {
    if (isIOS) {
      const originalElement = this.el.nativeElement as View;

      this.iosShadowRapper = this.render.createElement(
        'StackLayout'
      ) as StackLayout;

      // wrappingElement.cssClasses = mainElement.cssClasses;
      const parent = originalElement.parentNode;
      this.render.insertBefore(parent, this.iosShadowRapper, originalElement);
      this.render.removeChild(parent, originalElement);
      this.render.appendChild(this.iosShadowRapper, originalElement);
    }
  }

  onUnloaded() {
    this.loaded = false;

    if (isAndroid) {
      this.el.nativeElement._redrawNativeBackground = this.originalNSFn; // always revert to the original method
    }
  }
  ngAfterViewInit() {
    this.addIosWrapper();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      this.loaded &&
      !!changes &&
      (changes.hasOwnProperty('shadow') ||
        changes.hasOwnProperty('elevation') ||
        changes.hasOwnProperty('pressedElevation') ||
        changes.hasOwnProperty('shape') ||
        changes.hasOwnProperty('bgcolor') ||
        changes.hasOwnProperty('cornerRadius') ||
        changes.hasOwnProperty('pressedTranslationZ') ||
        changes.hasOwnProperty('forcePressAnimation') ||
        changes.hasOwnProperty('translationZ') ||
        changes.hasOwnProperty('maskToBounds') ||
        changes.hasOwnProperty('shadowColor') ||
        changes.hasOwnProperty('shadowOffset') ||
        changes.hasOwnProperty('shadowOpacity') ||
        changes.hasOwnProperty('shadowRadius') ||
        changes.hasOwnProperty('rasterize') ||
        changes.hasOwnProperty('useShadowMap'))
    ) {
      if (
        changes.hasOwnProperty('shadow') &&
        !changes.hasOwnProperty('elevation') &&
        typeof changes.shadow.currentValue === 'number'
      ) {
        this.elevation = changes.shadow.currentValue;
      }
      if (changes.shadow && changes.shadow.currentValue.elevation) {
        if (isAndroid) {
          this.loadFromAndroidData(this.shadow as AndroidData);
        } else if (isIOS) {
          this.loadFromIOSData(this.shadow as IOSData);
        }
      }
      this.applyShadow();
    }
  }

  private monkeyPatch = val => {
    this.previousNSFn.call(this.el.nativeElement, val);
    this.applyShadow();
  };

  private applyShadow() {
    if (
      this.shadow === null ||
      this.shadow === undefined ||
      (this.shadow === '' && !this.elevation)
    ) {
      return;
    }

    // For shadows to be shown on Android the SDK has to be greater
    // or equal than 21, lower SDK means no setElevation method is available
    if (isAndroid) {
      if (android.os.Build.VERSION.SDK_INT < 21) {
        return;
      }
    }

    const viewToApplyShadowTo = isIOS
      ? this.iosShadowRapper
      : this.el.nativeElement;

    if (viewToApplyShadowTo) {
      Shadow.apply(viewToApplyShadowTo, {
        elevation: this.elevation as number,
        pressedElevation: this.pressedElevation as number,
        shape: this.shape,
        bgcolor: this.bgcolor,
        cornerRadius: <number>this.cornerRadius,
        translationZ: <number>this.translationZ,
        pressedTranslationZ: <number>this.pressedTranslationZ,
        forcePressAnimation: this.forcePressAnimation,
        maskToBounds: this.maskToBounds,
        shadowColor: this.shadowColor,
        shadowOffset: this.shadowOffset as number,
        shadowOpacity: this.shadowOpacity as number,
        shadowRadius: this.shadowRadius as number,
        rasterize: this.rasterize,
        useShadowPath: this.useShadowPath
      });
    }
  }

  private initializeCommonData() {
    const tShadow = typeof this.shadow;
    if ((tShadow === 'string' || tShadow === 'number') && !this.elevation) {
      this.elevation = this.shadow ? parseInt(this.shadow as string, 10) : 2;
    }
    const tElevation = typeof this.elevation;
    if (tElevation === 'string' || tElevation === 'number') {
      this.elevation = this.elevation
        ? parseInt(this.elevation as string, 10)
        : 2;
    }
  }

  private initializeAndroidData() {
    if (typeof this.cornerRadius === 'string') {
      this.cornerRadius = parseInt(this.cornerRadius, 10);
    }
    if (typeof this.translationZ === 'string') {
      this.translationZ = parseInt(this.translationZ, 10);
    }
  }

  private initializeIOSData() {
    if (typeof this.shadowOffset === 'string') {
      this.shadowOffset = parseFloat(this.shadowOffset);
    }
    if (typeof this.shadowOpacity === 'string') {
      this.shadowOpacity = parseFloat(this.shadowOpacity);
    }
    if (typeof this.shadowRadius === 'string') {
      this.shadowRadius = parseFloat(this.shadowRadius);
    }
  }

  private loadFromAndroidData(data: AndroidData) {
    this.elevation = data.elevation || this.elevation;
    this.shape = data.shape || this.shape;
    this.bgcolor = data.bgcolor || this.bgcolor;
    this.cornerRadius = data.cornerRadius || this.cornerRadius;
    this.translationZ = data.translationZ || this.translationZ;
  }

  private loadFromIOSData(data: IOSData) {
    this.maskToBounds = data.maskToBounds || this.maskToBounds;
    this.shadowColor = data.shadowColor || this.shadowColor;
    this.shadowOffset = data.shadowOffset || this.shadowOffset;
    this.shadowOpacity = data.shadowOpacity || this.shadowOpacity;
    this.shadowRadius = data.shadowRadius || this.shadowRadius;
    this.rasterize = data.rasterize || this.rasterize;
    this.useShadowPath = data.useShadowPath || this.useShadowPath;
  }
}
