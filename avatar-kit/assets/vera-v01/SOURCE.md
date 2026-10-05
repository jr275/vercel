# Vera v0.1 asset source

- Base: `mpfb.glb` from https://github.com/met4citizen/TalkingHead (avatars/mpfb.glb). Created by that project with Blender and the MPFB extension (MakeHuman ecosystem); the project states it is licensed **CC0**. I could not check the licence of every MakeHuman asset inside it independently.
- Processing (this repository, `gltf-transform` + `ktx2-encoder`): textures resized to 1024 where large, KTX2 (ETC1S for colour, UASTC for skin, eye and normal), meshopt compression, dense morph targets. 36.8 MB to 19.3 MB. Geometry and rig unchanged: 8 meshes, 66 morph targets, 67 bones, 84k triangles.
- `profile.json`: colour and roughness overrides applied at runtime (black matte clothing, darker hair, slightly deeper skin).
- Not a scan of a real person. Not Vera's final identity: a **visual prototype**.
