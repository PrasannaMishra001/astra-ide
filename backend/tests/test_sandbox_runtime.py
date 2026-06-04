"""
B4 tier enforcement: the chosen tier must become the Pod's runtimeClassName, and
every pod must carry the defence-in-depth hardening regardless of tier.
"""
import unittest

from app.services import sandbox_runtime as sr


def _m(tier="runc", **kw):
    base = dict(workspace_id=7, user_id=3, language="python", tier=tier,
                pod_name="ws-3-abc")
    base.update(kw)
    return sr.build_workspace_pod_manifest(**base)


class TestRuntimeClassMapping(unittest.TestCase):
    def test_tier_becomes_runtime_class(self):
        for tier in ("runc", "gvisor", "firecracker"):
            self.assertEqual(_m(tier=tier)["spec"]["runtimeClassName"], tier)

    def test_unknown_tier_rejected(self):
        with self.assertRaises(ValueError):
            _m(tier="sandbox9000")

    def test_isolation_runtimes_pin_to_labelled_nodes(self):
        self.assertEqual(_m(tier="gvisor")["spec"]["nodeSelector"],
                         {"sandbox.astra-ide.io/gvisor": "true"})
        self.assertEqual(_m(tier="firecracker")["spec"]["nodeSelector"],
                         {"sandbox.astra-ide.io/firecracker": "true"})
        self.assertNotIn("nodeSelector", _m(tier="runc")["spec"])


class TestDefenceInDepth(unittest.TestCase):
    def test_every_tier_drops_caps_and_privesc(self):
        for tier in ("runc", "gvisor", "firecracker"):
            sc = _m(tier=tier)["spec"]["containers"][0]["securityContext"]
            self.assertEqual(sc["capabilities"]["drop"], ["ALL"])
            self.assertFalse(sc["allowPrivilegeEscalation"])
            self.assertFalse(sc["privileged"])
            self.assertTrue(sc["runAsNonRoot"])
            self.assertEqual(sc["seccompProfile"]["type"], "RuntimeDefault")

    def test_readonly_rootfs_tracks_filesystem_write(self):
        self.assertTrue(_m(filesystem_write=False)["spec"]["containers"][0]
                        ["securityContext"]["readOnlyRootFilesystem"])
        self.assertFalse(_m(filesystem_write=True)["spec"]["containers"][0]
                         ["securityContext"]["readOnlyRootFilesystem"])

    def test_no_service_account_token_mounted(self):
        self.assertFalse(_m()["spec"]["automountServiceAccountToken"])

    def test_egress_label_tracks_network_access(self):
        self.assertEqual(_m(network_access=False)["metadata"]["labels"]["egress"], "deny")
        self.assertEqual(_m(network_access=True)["metadata"]["labels"]["egress"], "allow")

    def test_resource_limits_present(self):
        res = _m(cpu_request=1.0, memory_request=1024)["spec"]["containers"][0]["resources"]
        self.assertEqual(res["requests"]["memory"], "1024Mi")
        self.assertEqual(res["limits"]["memory"], "2048Mi")


if __name__ == "__main__":
    unittest.main(verbosity=2)
