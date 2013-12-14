module.exports = {
    /**
     * Deprecated. Use crop instead.
     * This function is the equivalent of crop(size, size).
     *
     * @param size
     */
    squareCenterCrop: function(size) {
        return this.resize(size, size, "^").
            gravity("Center").
            extent(size, size);
    },

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