module.exports = {
    /**
     * Crops an image. The resulting image will always be exactly
     * [width] wide and [height] tall. By default it will center the
     * crop area inside the original image, but you can control this
     * with the third parameter (gravity).
     *
     * @param width
     * @param height
     * @param gravity
     */
    crop: function(width, height, gravity) {
        gravity = gravity || "Center";
        return this.resize(width, height, "^").
            gravity(gravity).
            extent(width, height);
    }
};