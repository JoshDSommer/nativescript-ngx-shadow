import { Color } from 'tns-core-modules/color';

import { AndroidData } from "./android-data.model";
import { IOSData } from "./ios-data.model";
import { ShapeEnum } from './shape.enum';
import { Length } from 'tns-core-modules/ui/page/page';
import { isAndroid, screen } from "tns-core-modules/platform";

declare const android: any;
declare const java: any;
declare const CGSizeMake: any;
declare const UIScreen: any;
declare const Array: any;
declare const UIBezierPath: any;
const ViewOutlineProvider: { new(); BACKGROUND: any } = android.view.ViewOutlineProvider;

class ShadowOutlineProvider extends ViewOutlineProvider {
  owner: WeakRef<any>;
  /**
   * Create an outline from a tns view
   * @param owner tns view
   */
  constructor(owner: any) {
    super();
    this.owner = new WeakRef(owner);
    return global.__native(this);
  }

  getOutline(view, outline) {
    const owner = this.owner.get();
    if (owner) {
      const outerRadii = Array.create("float", 8);
      outerRadii[0] = outerRadii[1] = Length.toDevicePixels(owner.borderTopLeftRadius, 0);
      outerRadii[2] = outerRadii[3] = Length.toDevicePixels(owner.borderTopRightRadius, 0);
      outerRadii[4] = outerRadii[5] = Length.toDevicePixels(owner.borderBottomRightRadius, 0);
      outerRadii[6] = outerRadii[7] = Length.toDevicePixels(owner.borderBottomLeftRadius, 0);
      const backgroundPath = new android.graphics.Path();
      backgroundPath.addRoundRect(new android.graphics.RectF(0, 0, view.getWidth(), view.getHeight()), outerRadii, android.graphics.Path.Direction.CW)
      outline.setConvexPath(backgroundPath);
    }
  }
}

export class Shadow {
  static DEFAULT_SHAPE = ShapeEnum.RECTANGLE;
  static DEFAULT_BGCOLOR = '#FFFFFF';
  static DEFAULT_SHADOW_COLOR = '#000000';
  static DEFAULT_PRESSED_ELEVATION = 2;
  static DEFAULT_PRESSED_Z = 4;

  static apply(tnsView: any, data: IOSData | AndroidData) {
    const LOLLIPOP = 21;
    if (
      tnsView.android &&
      android.os.Build.VERSION.SDK_INT >= LOLLIPOP
    ) {
      Shadow.applyOnAndroid(tnsView, Shadow.getDefaults(data));
    } else if (tnsView.ios) {
      Shadow.applyOnIOS(tnsView, Shadow.getDefaults(data));
    }
  }

  private static getDefaults(data: IOSData | AndroidData) {
    return Object.assign(
      {},
      data,
      {
        shape: (data as AndroidData).shape || Shadow.DEFAULT_SHAPE,
        pressedElevation: (data as AndroidData).pressedElevation || Shadow.DEFAULT_PRESSED_ELEVATION,
        pressedTranslationZ: (data as AndroidData).pressedTranslationZ || Shadow.DEFAULT_PRESSED_ELEVATION,
        shadowColor: (data as IOSData).shadowColor ||
          Shadow.DEFAULT_SHADOW_COLOR,
        useShadowPath: ((data as IOSData).useShadowPath !== undefined ? (data as IOSData).useShadowPath : true),
        rasterize: ((data as IOSData).rasterize !== undefined ? (data as IOSData).rasterize : false)
      },
    );
  }

  private static applyOnAndroid(tnsView: any, data: AndroidData) {
    const nativeView = tnsView.android;


    let currentBg = nativeView.getBackground();
    console.log(tnsView, tnsView.text, "Background: " + (currentBg ? currentBg.getClass().toString() : null));

    // TODO: how to detect if view doesn't need this? (button)
    let shouldOverrideOutline = true;
    if (currentBg instanceof android.graphics.drawable.RippleDrawable) { // play nice if a ripple is wrapping a shadow
      let rippleBg = currentBg.getDrawable(0);
      if (rippleBg instanceof android.graphics.drawable.InsetDrawable) {
        shouldOverrideOutline = false;
      }
    }
    if (shouldOverrideOutline) {
      if (!(nativeView.getOutlineProvider() instanceof ShadowOutlineProvider)) {
        nativeView.setOutlineProvider(new ShadowOutlineProvider(tnsView));
      }
    } else if (nativeView.getOutlineProvider() instanceof ShadowOutlineProvider) {
      // if we shouldn't be overrinding, but are, reset to default
      nativeView.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
    }

    nativeView.setElevation(
      Shadow.androidDipToPx(nativeView, data.elevation as number),
    );
    nativeView.setTranslationZ(
      Shadow.androidDipToPx(nativeView, data.translationZ as number),
    );
    if (nativeView.getStateListAnimator() || data.forcePressAnimation) {
      this.overrideDefaultAnimator(nativeView, data);
    }
  }

  private static overrideDefaultAnimator(nativeView: any, data: AndroidData) {
    const sla = new android.animation.StateListAnimator();

    const ObjectAnimator = android.animation.ObjectAnimator;
    const AnimatorSet = android.animation.AnimatorSet;
    const shortAnimTime = android.R.integer.config_shortAnimTime;

    const buttonDuration =
      nativeView.getContext().getResources().getInteger(shortAnimTime) / 2;
    const pressedElevation = this.androidDipToPx(nativeView, data.pressedElevation);
    const pressedZ = this.androidDipToPx(nativeView, data.pressedTranslationZ);
    const elevation = this.androidDipToPx(nativeView, data.elevation);
    const z = this.androidDipToPx(nativeView, data.translationZ || 0);

    const pressedSet = new AnimatorSet();
    const notPressedSet = new AnimatorSet();
    const defaultSet = new AnimatorSet();

    pressedSet.playTogether(java.util.Arrays.asList([
      ObjectAnimator.ofFloat(nativeView, "translationZ", [pressedZ])
        .setDuration(buttonDuration),
      ObjectAnimator.ofFloat(nativeView, "elevation", [pressedElevation])
        .setDuration(0),
    ]));
    notPressedSet.playTogether(java.util.Arrays.asList([
      ObjectAnimator.ofFloat(nativeView, "translationZ", [z])
        .setDuration(buttonDuration),
      ObjectAnimator.ofFloat(nativeView, "elevation", [elevation])
        .setDuration(0),
    ]));
    defaultSet.playTogether(java.util.Arrays.asList([
      ObjectAnimator.ofFloat(nativeView, "translationZ", [0]).setDuration(0),
      ObjectAnimator.ofFloat(nativeView, "elevation", [0]).setDuration(0),
    ]));

    sla.addState(
      [android.R.attr.state_pressed, android.R.attr.state_enabled],
      pressedSet,
    );
    sla.addState([android.R.attr.state_enabled], notPressedSet);
    sla.addState([], defaultSet);
    nativeView.setStateListAnimator(sla);
  }

  private static applyOnIOS(tnsView: any, data: IOSData) {
    const nativeView = tnsView.ios;
    const elevation = parseFloat(((data.elevation as number) - 0).toFixed(2));
    nativeView.layer.maskToBounds = false;
    nativeView.layer.shadowColor = new Color(data.shadowColor).ios.CGColor;
    nativeView.layer.shadowOffset =
      data.shadowOffset ?
        CGSizeMake(0, parseFloat(String(data.shadowOffset))) :
        CGSizeMake(0, 0.54 * elevation - 0.14);
    nativeView.layer.shadowOpacity =
      data.shadowOpacity ?
        parseFloat(String(data.shadowOpacity)) :
        0.006 * elevation + 0.25;
    nativeView.layer.shadowRadius =
      data.shadowRadius ?
        parseFloat(String(data.shadowRadius)) :
        0.66 * elevation - 0.5;
    nativeView.layer.shouldRasterize = data.rasterize;
    nativeView.layer.rasterizationScale = screen.mainScreen.scale;
    let shadowPath = null;
    if (data.useShadowPath) {
      shadowPath = UIBezierPath.bezierPathWithRoundedRectCornerRadius(nativeView.bounds, nativeView.layer.shadowRadius).cgPath;
    }
    nativeView.layer.shadowPath = shadowPath;
  }

  static androidDipToPx(nativeView: any, dip: number) {
    const metrics = nativeView.getContext().getResources().getDisplayMetrics();
    return android.util.TypedValue.applyDimension(
      android.util.TypedValue.COMPLEX_UNIT_DIP,
      dip,
      metrics,
    );
  }
}
