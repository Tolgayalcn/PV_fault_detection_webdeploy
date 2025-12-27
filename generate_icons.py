#!/usr/bin/env python3
"""
Generate PWA icons from a base icon or create simple placeholder icons.
Run this script to generate all required icon sizes.
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Icon sizes required for PWA
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

def create_icon(size, output_path):
    """Create a simple solar panel icon."""
    # Create image with gradient background
    img = Image.new('RGB', (size, size), '#4361ee')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple sun/solar pattern
    center = size // 2
    radius = size // 3
    
    # Background circle
    draw.ellipse(
        [center - radius, center - radius, center + radius, center + radius],
        fill='#ffd60a'
    )
    
    # Inner circle
    inner_radius = radius // 2
    draw.ellipse(
        [center - inner_radius, center - inner_radius, 
         center + inner_radius, center + inner_radius],
        fill='#ff9500'
    )
    
    # Sun rays
    ray_length = size // 6
    for angle in range(0, 360, 45):
        import math
        rad = math.radians(angle)
        x1 = center + int((radius + 5) * math.cos(rad))
        y1 = center + int((radius + 5) * math.sin(rad))
        x2 = center + int((radius + ray_length) * math.cos(rad))
        y2 = center + int((radius + ray_length) * math.sin(rad))
        draw.line([(x1, y1), (x2, y2)], fill='#ffd60a', width=max(2, size // 50))
    
    # Save
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")

def main():
    # Create icons directory
    icons_dir = os.path.join(os.path.dirname(__file__), 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    
    # Generate all sizes
    for size in SIZES:
        output_path = os.path.join(icons_dir, f'icon-{size}.png')
        create_icon(size, output_path)
    
    print(f"\n✅ Generated {len(SIZES)} icons in {icons_dir}")

if __name__ == '__main__':
    main()
