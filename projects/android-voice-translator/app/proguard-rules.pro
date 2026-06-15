# ML Kit reflectively loads model components; keep its classes intact.
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**
