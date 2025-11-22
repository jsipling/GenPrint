Role:
Act as a Senior Frontend Developer and 3D Printing enthusiast.

Project:
I want to build a client-side web application called "GenPrint." It is a tool for 3D printer owners to generate simple, functional parts (like spacers, boxes, and gears) by adjusting sliders, viewing the 3D model in real-time, and downloading the STL.

Constraints & Philosophy:

    Keep it Simple: No backend, no database. The app must run entirely in the browser (Client-side).

    Tech Stack: React, Vite, TypeScript, Tailwind CSS.

    Core Tech: Use openscad-wasm to compile SCAD code to STL in the browser. Use react-three-fiber (Three.js) to render the generated geometry.

    Scalability: The code should be structured so I can easily add new "Generators" just by adding a new entry to a JSON/Object list (containing the SCAD code and the parameter definitions).

Task 1: The MVP
Create a functional MVP for GenPrint with the following features:

    Layout: A sidebar on the left for parameters, and a large 3D viewer on the right.

    The Engine: Initialize openscad-wasm correctly.

    The First Model: Implement a "Cylindrical Spacer" as the test case.

        Parameters: Outer Diameter (10-100mm), Inner Hole Diameter (2-50mm), Height (1-50mm).

        SCAD Code to use:
        code Openscad

            
        outer_diameter = 20; // [10:100]
        inner_hole = 5;      // [2:50]
        height = 10;         // [1:50]
        $fn = 60;

        difference() {
            cylinder(h=height, d=outer_diameter);
            translate([0,0,-1]) cylinder(h=height+2, d=inner_hole);
        }

          

    Interactivity: When I move a slider, the 3D viewer should update (debounced slightly to prevent lag).

    Export: A button to "Download STL".

Implementation Details:

    Please create a useOpenSCAD hook to handle the WASM loading and compilation.

    Please create a ModelRegistry file where I can define the available models, their default parameters, and their SCAD scripts.

    Ensure the 3D viewer has basic orbit controls and simple lighting.
