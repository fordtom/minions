{
  inputs = {
    # Non-strict version packages come from here
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";

    # Utility for building this flake
    flake-utils.url = "github:numtide/flake-utils";

    # Overlay for bringing in the zig compiler for the simulation DLL
    zig-overlay.url = "github:mitchellh/zig-overlay";
    zig-overlay.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    zig-overlay,
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [zig-overlay.overlays.default];
        };
      in {
        packages.test = pkgs.writeShellScriptBin "test-minion" ''
          # Handle SIGTERM gracefully
          trap 'echo "Received SIGTERM, exiting..."; exit 0' TERM

          echo "=== Test Minion ==="
          echo "PID: $$"
          echo "Args: $@"
          echo "Arg count: $#"
          echo ""
          echo "=== Environment Variables ==="
          echo "USER: $USER"
          echo "PWD: $PWD"
          echo ""
          echo "=== Custom Vars (if set) ==="
          echo "TEST_VAR: ''${TEST_VAR:-<not set>}"
          echo "CUSTOM_VAR: ''${CUSTOM_VAR:-<not set>}"
          echo ""
          echo "=== All Args Individually ==="
          for i in "$@"; do
            echo "  - $i"
          done
          echo ""
          echo "Running indefinitely (kill with: kill $$)"
          while true; do sleep 1; done
        '';

        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.zigpkgs."0.15.1"
            pkgs.sqlite
          ];
        };
      }
    );
}
