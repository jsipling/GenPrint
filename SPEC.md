Technical Specification: GenPrint (Generative Spatial Modeler)
1. Executive Summary
GenPrint is an AI-native CAD application designed to turn conversational intent into 3D-printable geometry. By utilizing the Manifold 3D kernel (WASM) for robust geometry and Three.js for interactive visualization, GenPrint eliminates the "articulation gap" found in code-only CAD. It allows users to manipulate models through a combination of natural language, visual "ghost" gizmos, and semantic direct-selection.
2. Core Architecture
GenPrint is built as a Two-Way Bridge between a parametric TypeScript codebase and a real-time 3D scene.
Geometry Engine: manifold-3d. Chosen for its guaranteed manifold output (water-tight for 3D printing) and high-speed Boolean operations.
Rendering Layer: three.js. Used for the scene graph, lighting, and "Direct-to-Code" interaction widgets.
Backend: AI Model (GPT-4o or Claude 3.5) specialized in the GenPrint DSL (a standard TypeScript library wrapped around Manifold 3D).
3. The "Direct-Intent" Interface
GenPrint moves away from pure text prompts by using the following "Spatial Intermediaries":
3.1 Semantic Picking (Visual-to-Code Mapping)
Because Manifold 3D tracks OriginalID across Boolean operations (Union, Subtract, Intersect):
The Feature: When a user clicks a specific face or hole in the 3D viewport, GenPrint identifies the exact line of code that generated that feature.
The AI Context: The user selection is sent to the AI as a scoped reference. Instead of saying "the hole," the user just points, and the app sends: "Update the parameters for part_502 (mounting_bracket)."
3.2 "Ghost" Gizmos (Clumsy Input to Precise Code)
The Feature: Users can drag arrows or rings to move/rotate objects roughly in space.
The Translation: These "clumsy" mouse movements are not saved as hard coordinates. Instead, they are converted into a Spatial Prompt: "The user manually slid this part +12.4mm on the Y-axis. Refactor the code to center it on the nearest available face."
The Result: The AI writes clean, parametric code that matches the user's visual "nudge."
4. Generative Features for Printing
As the name GenPrint suggests, the app includes features specifically for additive manufacturing:
4.1 Automated Print-Ability Check (Vision Feedback)
Every time the AI generates a design, the app runs a "Mesh Audit":
Wall Thickness Check: Identifies areas thinner than the user's specified nozzle size (e.g., 0.4mm).
Overhang Analysis: Highlights faces that require support structures.
The Loop: The app sends this data back to the AI: "The design is 90% complete, but the handle has a 2mm section that will fail to print. Please thicken it relative to the base_width variable."
4.2 Smooth-Merge (Organic Generative Logic)
Using Manifold 3D’s speed, GenPrint implements a "Melt" command.
Input: "Smoothly merge the leg into the table top."
Action: The AI utilizes the SmoothUnion or Hull functions in the Manifold kernel, creating organic, structural fillets that are much stronger for 3D printing than sharp corners.
5. System Data Flow
Component	Role	Data Output
User Input	Point/Drag + Voice/Text	Semantic ID + Intent String
Prompt Engine	Combines Code + Mesh Metadata + User Intent	Enriched AI Prompt
GenPrint AI	Generates/Edits TypeScript Code	Functional TS Code Block
Manifold Worker	Compiles TS 
→
→
 Manifold WASM	Manifold Mesh Object
Three.js	Renders Mesh + Interactive Widgets	Visual 3D Feedback
6. Development Roadmap & Export
Interactive DSL: A custom TypeScript library (@genprint/core) that makes Manifold 3D calls more human-readable (e.g., box.alignTo(plate, "center")).
One-Click Slice: Direct integration with slicing engines (or export to 3MF/STL) that includes metadata about the AI’s design intent.
Version Control: A "Time Travel" feature where users can scrub back through the AI's iterations visually, rather than just in a text git-log.
Why GenPrint?
By using Manifold 3D, GenPrint ensures that every design the AI creates is physically "correct"—meaning no self-intersections or holes that break slicers. By using Three.js, it allows the user to communicate with the AI through the universal language of pointing at things, solving the problem of not knowing how to articulate complex 3D rotations or offsets.
